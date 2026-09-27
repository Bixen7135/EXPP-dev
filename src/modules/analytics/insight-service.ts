import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { aiGenerate } from "@/lib/ai/gateway";
import { resolveAiModel } from "@/lib/ai/models";
import type { QuestionType } from "@/lib/question-scoring";
import { ensureStudentAnalyticsInsightWorkerAutoStarted } from "./insight-auto-worker";
import {
  enqueueStudentAnalyticsInsightJob,
  type StudentAnalyticsInsightJobData,
} from "./insight-queue";

export type AnalyticsPeriod = "all_time";
export const DEFAULT_ANALYTICS_PERIOD: AnalyticsPeriod = "all_time";

export type RecommendationStatus =
  | "READY"
  | "PROCESSING"
  | "STALE"
  | "FAILED"
  | "LOW_CONFIDENCE"
  | "INSUFFICIENT_DATA";

export interface WeakQuestionTypeStat {
  type: QuestionType;
  lowCount: number;
  total: number;
  lowRate: number;
}

export interface AiHelpUsageStat {
  allowed: number;
  blocked: number;
  total: number;
}

export interface AnalyticsOverview {
  avgPercent: number | null;
  completionRate: number;
  publishedCount: number;
  onTimeRate: number;
  trendDelta: number;
  weakQuestionTypes: WeakQuestionTypeStat[];
  aiHelpUsage: AiHelpUsageStat;
  totalAssignments: number;
  submittedCount: number;
}

export interface InsightRecommendation {
  summary: string;
  improvementAreas: string[];
  studyPlan: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
  evidenceRefs: string[];
  generatedAt: string;
}

export interface BreakdownByTeacher {
  teacherId: string;
  teacherName: string;
  overview: AnalyticsOverview;
}

export interface BreakdownBySubject {
  subjectKey: string;
  subjectLabel: string;
  overview: AnalyticsOverview;
}

export interface InsightScope {
  learnerAccountId: string;
  teacherAccountId: string | null;
  subjectKey: string | null;
  period: AnalyticsPeriod;
}

export interface LearnerInsightView {
  overview: AnalyticsOverview;
  teacherBreakdown: BreakdownByTeacher[];
  subjectBreakdown: BreakdownBySubject[];
  recommendation: InsightRecommendation | null;
  recommendationStatus: RecommendationStatus;
  subjectFilterApplied: string | null;
}

export interface TeacherStudentInsight {
  learnerAccountId: string;
  learnerName: string;
  overview: AnalyticsOverview;
  recommendation: InsightRecommendation | null;
  recommendationStatus: RecommendationStatus;
}

export interface AnalyticsRow {
  recipientId: string;
  assignmentTitle: string;
  distributionId: string;
  deadline: Date | null;
  recipientStatus: "PENDING" | "ACTIVE" | "SUBMITTED";
  teacherId: string;
  teacherName: string;
  subjectKey: string;
  subjectLabel: string;
  submittedAt: Date | null;
  attemptStatus: "DRAFT" | "SUBMITTED" | null;
  helpRequestStatuses: Array<"ALLOWED" | "BLOCKED">;
  assessmentStatus: string | null;
  manualGrade: number | null;
  maxGrade: number | null;
  publishedAt: Date | null;
  itemScores: Array<{ type: QuestionType; ratio: number }>;
}

const recommendationSchema = z.object({
  summary: z.string().min(1).max(700),
  improvementAreas: z.array(z.string()).max(8).default([]),
  studyPlan: z.array(z.string()).max(8).default([]),
  confidenceValue: z.number().min(0).max(1),
  evidenceRefs: z.array(z.string()).max(12).default([]),
});

const VALID_QUESTION_TYPES = new Set<QuestionType>([
  "MULTIPLE_CHOICE",
  "SHORT_ANSWER",
  "LONG_ANSWER",
]);

const MIN_RELIABLE_PUBLISHED = 3;
const DEFAULT_INSIGHT_ENQUEUE_TIMEOUT_MS = 1_500;

export function normalizeSubjectKey(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : null;
}

export function normalizeSubjectLabel(value: string | null | undefined): string {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : "\u041E\u0431\u0449\u0438\u0439";
}

function mapAssignmentTags(tags: unknown): Array<{ key: string; value: string }> {
  if (!Array.isArray(tags)) return [];

  return tags
    .map((rawTag) => toRecord(rawTag))
    .filter((tag): tag is Record<string, unknown> => tag !== null)
    .map((tag) => ({
      key: typeof tag.key === "string" ? tag.key : "",
      value: typeof tag.value === "string" ? tag.value : "",
    }))
    .filter((tag) => tag.key.length > 0);
}

export function resolveSubjectFromAssignmentContext(opts: {
  tags: Array<{ key: string; value: string }>;
  generationConstraints: unknown;
}): { subjectKey: string; subjectLabel: string } {
  const tag = opts.tags.find((item) => item.key.trim().toLowerCase() === "subject");
  const tagLabel = normalizeSubjectLabel(tag?.value);
  const tagKey = normalizeSubjectKey(tag?.value);
  if (tagKey) return { subjectKey: tagKey, subjectLabel: tagLabel };

  const constraints = toRecord(opts.generationConstraints);
  const topic = typeof constraints?.topic === "string" ? constraints.topic : null;
  const topicLabel = normalizeSubjectLabel(topic);
  const topicKey =
    normalizeSubjectKey(topicLabel) ?? "\u043E\u0431\u0449\u0438\u0439";

  return { subjectKey: topicKey, subjectLabel: topicLabel };
}

export function buildInsightScopes(input: {
  learnerAccountId: string;
  teacherAccountId: string;
  subjectKey: string;
  period?: AnalyticsPeriod;
}): InsightScope[] {
  const period = input.period ?? DEFAULT_ANALYTICS_PERIOD;
  const scopes: InsightScope[] = [
    {
      learnerAccountId: input.learnerAccountId,
      teacherAccountId: null,
      subjectKey: null,
      period,
    },
    {
      learnerAccountId: input.learnerAccountId,
      teacherAccountId: input.teacherAccountId,
      subjectKey: null,
      period,
    },
    {
      learnerAccountId: input.learnerAccountId,
      teacherAccountId: null,
      subjectKey: input.subjectKey,
      period,
    },
    {
      learnerAccountId: input.learnerAccountId,
      teacherAccountId: input.teacherAccountId,
      subjectKey: input.subjectKey,
      period,
    },
  ];

  const dedup = new Map<string, InsightScope>();
  for (const scope of scopes) {
    const signature = `${scope.learnerAccountId}:${scope.teacherAccountId ?? "*"}:${scope.subjectKey ?? "*"}:${scope.period}`;
    dedup.set(signature, scope);
  }
  return [...dedup.values()];
}

export function calculateOverview(rows: AnalyticsRow[]): AnalyticsOverview {
  const totalAssignments = rows.length;
  const submittedRows = rows.filter((row) => row.recipientStatus === "SUBMITTED");
  const submittedCount = submittedRows.length;
  const publishedRows = rows.filter(
    (row) =>
      row.assessmentStatus === "PUBLISHED" &&
      row.manualGrade !== null &&
      row.maxGrade !== null &&
      row.maxGrade > 0
  );

  const percentages = publishedRows.map(
    (row) => (row.manualGrade! / row.maxGrade!) * 100
  );

  const avgPercent = percentages.length > 0 ? roundTo1(avg(percentages)) : null;
  const completionRate =
    totalAssignments > 0 ? roundTo1((submittedCount / totalAssignments) * 100) : 0;
  const publishedCount = publishedRows.length;
  const onTimeRate =
    submittedCount > 0
      ? roundTo1(
          (submittedRows.filter((row) =>
            row.deadline ? (row.submittedAt ? row.submittedAt <= row.deadline : false) : true
          ).length /
            submittedCount) *
            100
        )
      : 0;

  const trendDelta = calculateTrendDelta(publishedRows);
  const weakQuestionTypes = calculateWeakQuestionTypes(publishedRows);
  const aiHelpUsage = calculateAiHelpUsage(rows);

  return {
    avgPercent,
    completionRate,
    publishedCount,
    onTimeRate,
    trendDelta,
    weakQuestionTypes,
    aiHelpUsage,
    totalAssignments,
    submittedCount,
  };
}

export async function loadLearnerAnalyticsRows(
  learnerAccountId: string
): Promise<AnalyticsRow[]> {
  const recipients = await prisma.assignmentRecipient.findMany({
    where: { recipientAccountId: learnerAccountId },
    orderBy: { createdAt: "desc" },
    include: {
      distribution: {
        include: {
          creatorAccount: { select: { displayName: true } },
          version: { select: { content: true } },
          assignment: {
            select: {
              title: true,
              tags: true,
              generationResult: {
                select: {
                  request: { select: { constraints: true } },
                },
              },
            },
          },
        },
      },
      attempt: {
        include: {
          helpRequests: { select: { status: true } },
          assessment: {
            select: {
              status: true,
              manualGrade: true,
              maxGrade: true,
              publishedAt: true,
              aiRecommendation: true,
              autoCheckResult: true,
            },
          },
        },
      },
    },
  });

  return recipients.map((recipient) => {
    const subject = resolveSubjectFromAssignmentContext({
      tags: mapAssignmentTags(recipient.distribution.assignment.tags),
      generationConstraints:
        recipient.distribution.assignment.generationResult?.request.constraints ?? null,
    });

    const itemTypesByOrder = extractQuestionTypesByOrder(
      recipient.distribution.version.content
    );
    const itemScores = extractItemScores({
      aiRecommendation: recipient.attempt?.assessment?.aiRecommendation,
      autoCheckResult: recipient.attempt?.assessment?.autoCheckResult,
      itemTypesByOrder,
    });

    return {
      recipientId: recipient.id,
      assignmentTitle: recipient.distribution.assignment.title,
      distributionId: recipient.distributionId,
      deadline: recipient.distribution.deadline,
      recipientStatus: recipient.status as "PENDING" | "ACTIVE" | "SUBMITTED",
      teacherId: recipient.distribution.creatorAccountId,
      teacherName: recipient.distribution.creatorAccount.displayName,
      subjectKey: subject.subjectKey,
      subjectLabel: subject.subjectLabel,
      submittedAt: recipient.attempt?.submittedAt ?? null,
      attemptStatus: recipient.attempt
        ? (recipient.attempt.status as "DRAFT" | "SUBMITTED")
        : null,
      helpRequestStatuses:
        recipient.attempt?.helpRequests.map((request) =>
          request.status === "BLOCKED" ? "BLOCKED" : "ALLOWED"
        ) ?? [],
      assessmentStatus: recipient.attempt?.assessment?.status ?? null,
      manualGrade: recipient.attempt?.assessment?.manualGrade ?? null,
      maxGrade: recipient.attempt?.assessment?.maxGrade ?? null,
      publishedAt: recipient.attempt?.assessment?.publishedAt ?? null,
      itemScores,
    };
  });
}

export async function buildLearnerInsightView(opts: {
  learnerAccountId: string;
  teacherId?: string | null;
  subject?: string | null;
  period?: AnalyticsPeriod;
}): Promise<LearnerInsightView> {
  const period = opts.period ?? DEFAULT_ANALYTICS_PERIOD;
  const subjectKey = normalizeSubjectKey(opts.subject);
  const rows = await loadLearnerAnalyticsRows(opts.learnerAccountId);

  const filtered = applyScope(rows, {
    teacherAccountId: opts.teacherId ?? null,
    subjectKey,
  });

  const overview = calculateOverview(filtered);
  const teacherBreakdown = buildTeacherBreakdown(rows);
  const subjectBreakdown = buildSubjectBreakdown(rows);

  const cached = await prisma.studentAnalyticsInsight.findFirst({
    where: {
      learnerAccountId: opts.learnerAccountId,
      teacherAccountId: opts.teacherId ?? null,
      subjectKey,
      period,
    },
    orderBy: { createdAt: "desc" },
  });

  const recommendation = parseRecommendationFromCache(cached?.recommendationJson);
  const recommendationStatus = resolveRecommendationStatus({
    overview,
    cacheStatus: cached?.status ?? null,
    recommendation,
  });

  return {
    overview,
    teacherBreakdown,
    subjectBreakdown,
    recommendation,
    recommendationStatus,
    subjectFilterApplied: subjectKey,
  };
}

export async function listTeacherStudentInsights(opts: {
  teacherAccountId: string;
  subject?: string | null;
  period?: AnalyticsPeriod;
}): Promise<TeacherStudentInsight[]> {
  const period = opts.period ?? DEFAULT_ANALYTICS_PERIOD;
  const subjectKey = normalizeSubjectKey(opts.subject);

  const recipients = await prisma.assignmentRecipient.findMany({
    where: {
      distribution: {
        creatorAccountId: opts.teacherAccountId,
      },
    },
    include: {
      recipientAccount: { select: { displayName: true } },
      distribution: {
        include: {
          creatorAccount: { select: { displayName: true } },
          version: { select: { content: true } },
          assignment: {
            select: {
              title: true,
              tags: true,
              generationResult: {
                select: {
                  request: { select: { constraints: true } },
                },
              },
            },
          },
        },
      },
      attempt: {
        include: {
          helpRequests: { select: { status: true } },
          assessment: {
            select: {
              status: true,
              manualGrade: true,
              maxGrade: true,
              publishedAt: true,
              aiRecommendation: true,
              autoCheckResult: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const byLearner = new Map<
    string,
    { learnerName: string; rows: AnalyticsRow[] }
  >();

  for (const recipient of recipients) {
    const subject = resolveSubjectFromAssignmentContext({
      tags: mapAssignmentTags(recipient.distribution.assignment.tags),
      generationConstraints:
        recipient.distribution.assignment.generationResult?.request.constraints ?? null,
    });

    const row: AnalyticsRow = {
      recipientId: recipient.id,
      assignmentTitle: recipient.distribution.assignment.title,
      distributionId: recipient.distributionId,
      deadline: recipient.distribution.deadline,
      recipientStatus: recipient.status as "PENDING" | "ACTIVE" | "SUBMITTED",
      teacherId: recipient.distribution.creatorAccountId,
      teacherName: recipient.distribution.creatorAccount.displayName,
      subjectKey: subject.subjectKey,
      subjectLabel: subject.subjectLabel,
      submittedAt: recipient.attempt?.submittedAt ?? null,
      attemptStatus: recipient.attempt
        ? (recipient.attempt.status as "DRAFT" | "SUBMITTED")
        : null,
      helpRequestStatuses:
        recipient.attempt?.helpRequests.map((request) =>
          request.status === "BLOCKED" ? "BLOCKED" : "ALLOWED"
        ) ?? [],
      assessmentStatus: recipient.attempt?.assessment?.status ?? null,
      manualGrade: recipient.attempt?.assessment?.manualGrade ?? null,
      maxGrade: recipient.attempt?.assessment?.maxGrade ?? null,
      publishedAt: recipient.attempt?.assessment?.publishedAt ?? null,
      itemScores: extractItemScores({
        aiRecommendation: recipient.attempt?.assessment?.aiRecommendation,
        autoCheckResult: recipient.attempt?.assessment?.autoCheckResult,
        itemTypesByOrder: extractQuestionTypesByOrder(
          recipient.distribution.version.content
        ),
      }),
    };

    if (subjectKey && row.subjectKey !== subjectKey) continue;

    const current = byLearner.get(recipient.recipientAccountId);
    if (current) {
      current.rows.push(row);
    } else {
      byLearner.set(recipient.recipientAccountId, {
        learnerName: recipient.recipientAccount.displayName,
        rows: [row],
      });
    }
  }

  const learnerIds = [...byLearner.keys()];
  const cachedRows = learnerIds.length
    ? await prisma.studentAnalyticsInsight.findMany({
        where: {
          learnerAccountId: { in: learnerIds },
          teacherAccountId: opts.teacherAccountId,
          subjectKey: subjectKey ?? null,
          period,
        },
      })
    : [];
  const cacheByLearner = new Map(
    cachedRows.map((row) => [row.learnerAccountId, row])
  );

  const result: TeacherStudentInsight[] = [];
  for (const [learnerAccountId, data] of byLearner.entries()) {
    const overview = calculateOverview(data.rows);
    const cached = cacheByLearner.get(learnerAccountId);
    const recommendation = parseRecommendationFromCache(cached?.recommendationJson);
    const recommendationStatus = resolveRecommendationStatus({
      overview,
      cacheStatus: cached?.status ?? null,
      recommendation,
    });

    result.push({
      learnerAccountId,
      learnerName: data.learnerName,
      overview,
      recommendation,
      recommendationStatus,
    });
  }

  return result.sort((a, b) => {
    const ap = a.overview.avgPercent ?? -1;
    const bp = b.overview.avgPercent ?? -1;
    return bp - ap;
  });
}

export async function recomputeAndPersistInsightScope(opts: {
  scope: InsightScope;
  traceId: string;
}): Promise<void> {
  const { scope } = opts;
  const existing = await findInsightByScope(scope);
  const processingRow = existing
    ? await prisma.studentAnalyticsInsight.update({
        where: { id: existing.id },
        data: {
          status: "PROCESSING",
          error: null,
        },
      })
    : await prisma.studentAnalyticsInsight.create({
        data: {
          learnerAccountId: scope.learnerAccountId,
          teacherAccountId: scope.teacherAccountId,
          subjectKey: scope.subjectKey,
          period: scope.period,
          status: "PROCESSING",
        },
      });

  const rows = await loadLearnerAnalyticsRows(scope.learnerAccountId);
  const scopedRows = applyScope(rows, {
    teacherAccountId: scope.teacherAccountId,
    subjectKey: scope.subjectKey,
  });
  const overview = calculateOverview(scopedRows);

  const recommendation = await buildRecommendation({
    learnerAccountId: scope.learnerAccountId,
    teacherAccountId: scope.teacherAccountId,
    subjectKey: scope.subjectKey,
    overview,
    traceId: opts.traceId,
  });

  await prisma.studentAnalyticsInsight.update({
    where: { id: processingRow.id },
    data: {
      status: "READY",
      metricsJson: overview as unknown as object,
      recommendationJson: recommendation as unknown as object,
      generatedAt: new Date(),
      staleAt: null,
      error: null,
    },
  });
}

export async function markInsightScopesStale(
  scopes: InsightScope[],
  reason: string
): Promise<void> {
  const now = new Date();
  await Promise.all(
    scopes.map(async (scope) => {
      const existing = await findInsightByScope(scope);
      if (existing) {
        await prisma.studentAnalyticsInsight.update({
          where: { id: existing.id },
          data: {
            status: "STALE",
            staleAt: now,
            error: reason,
          },
        });
        return;
      }

      await prisma.studentAnalyticsInsight.create({
        data: {
          learnerAccountId: scope.learnerAccountId,
          teacherAccountId: scope.teacherAccountId,
          subjectKey: scope.subjectKey,
          period: scope.period,
          status: "STALE",
          staleAt: now,
          error: reason,
        },
      });
    })
  );
}

export async function enqueueInsightRecomputeForPublishedAttempt(opts: {
  attemptId: string;
  traceId: string;
}): Promise<void> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: opts.attemptId },
    include: {
      recipient: {
        include: {
          distribution: {
            include: {
              assignment: {
                select: {
                  tags: true,
                  generationResult: {
                    select: {
                      request: { select: { constraints: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      assessment: { select: { status: true } },
    },
  });

  if (!attempt) return;
  if (attempt.assessment?.status !== "PUBLISHED") return;

  const subject = resolveSubjectFromAssignmentContext({
    tags: mapAssignmentTags(attempt.recipient.distribution.assignment.tags),
    generationConstraints:
      attempt.recipient.distribution.assignment.generationResult?.request.constraints ??
      null,
  });

  const scopes = buildInsightScopes({
    learnerAccountId: attempt.learnerAccountId,
    teacherAccountId: attempt.recipient.distribution.creatorAccountId,
    subjectKey: subject.subjectKey,
    period: DEFAULT_ANALYTICS_PERIOD,
  });

  await ensureStudentAnalyticsInsightWorkerAutoStarted();

  try {
    await Promise.all(
      scopes.map((scope) =>
        enqueueInsightJobWithTimeout({
          learnerAccountId: scope.learnerAccountId,
          teacherAccountId: scope.teacherAccountId,
          subjectKey: scope.subjectKey,
          period: scope.period,
          traceId: opts.traceId,
        })
      )
    );
  } catch (error) {
    await markInsightScopesStale(scopes, summarizeQueueError(error));
    throw error;
  }
}

async function enqueueInsightJobWithTimeout(
  data: StudentAnalyticsInsightJobData
): Promise<void> {
  const timeoutMs = getInsightEnqueueTimeoutMs();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let settled = false;

  await new Promise<void>((resolve, reject) => {
    timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(`Insight enqueue timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    enqueueStudentAnalyticsInsightJob(data)
      .then(() => {
        if (settled) return;
        settled = true;
        if (timeoutId) clearTimeout(timeoutId);
        resolve();
      })
      .catch((error: unknown) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (settled) return;
        settled = true;
        if (isQueueConnectivityError(error)) {
          reject(new Error("Student analytics insight queue service is unavailable"));
          return;
        }
        reject(error);
      });
  });
}

function getInsightEnqueueTimeoutMs(): number {
  const raw = process.env.STUDENT_ANALYTICS_INSIGHT_ENQUEUE_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_INSIGHT_ENQUEUE_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_INSIGHT_ENQUEUE_TIMEOUT_MS;
  }
  return parsed;
}

function isQueueConnectivityError(error: unknown): boolean {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code.toUpperCase()
      : "";

  const connectivityCodes = new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "EHOSTUNREACH",
    "ECONNABORTED",
  ]);
  if (connectivityCodes.has(code)) return true;

  const message = summarizeQueueError(error).toLowerCase();
  return (
    message.includes("redis") ||
    message.includes("connection is closed") ||
    message.includes("max retries per request")
  );
}

function summarizeQueueError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function findInsightByScope(scope: InsightScope) {
  return prisma.studentAnalyticsInsight.findFirst({
    where: {
      learnerAccountId: scope.learnerAccountId,
      teacherAccountId: scope.teacherAccountId,
      subjectKey: scope.subjectKey,
      period: scope.period,
    },
    orderBy: { createdAt: "desc" },
  });
}

function applyScope(
  rows: AnalyticsRow[],
  scope: { teacherAccountId: string | null; subjectKey: string | null }
): AnalyticsRow[] {
  return rows.filter((row) => {
    if (scope.teacherAccountId && row.teacherId !== scope.teacherAccountId) return false;
    if (scope.subjectKey && row.subjectKey !== scope.subjectKey) return false;
    return true;
  });
}

function buildTeacherBreakdown(rows: AnalyticsRow[]): BreakdownByTeacher[] {
  const groups = new Map<string, { teacherName: string; rows: AnalyticsRow[] }>();
  for (const row of rows) {
    const current = groups.get(row.teacherId);
    if (current) {
      current.rows.push(row);
    } else {
      groups.set(row.teacherId, { teacherName: row.teacherName, rows: [row] });
    }
  }

  return [...groups.entries()]
    .map(([teacherId, data]) => ({
      teacherId,
      teacherName: data.teacherName,
      overview: calculateOverview(data.rows),
    }))
    .sort((a, b) => (b.overview.avgPercent ?? -1) - (a.overview.avgPercent ?? -1));
}

function buildSubjectBreakdown(rows: AnalyticsRow[]): BreakdownBySubject[] {
  const groups = new Map<string, { subjectLabel: string; rows: AnalyticsRow[] }>();
  for (const row of rows) {
    const current = groups.get(row.subjectKey);
    if (current) {
      current.rows.push(row);
    } else {
      groups.set(row.subjectKey, { subjectLabel: row.subjectLabel, rows: [row] });
    }
  }

  return [...groups.entries()]
    .map(([subjectKey, data]) => ({
      subjectKey,
      subjectLabel: data.subjectLabel,
      overview: calculateOverview(data.rows),
    }))
    .sort((a, b) => (b.overview.avgPercent ?? -1) - (a.overview.avgPercent ?? -1));
}

function calculateTrendDelta(rows: AnalyticsRow[]): number {
  const published = rows
    .filter(
      (row) =>
        row.manualGrade !== null &&
        row.maxGrade !== null &&
        row.maxGrade > 0 &&
        row.publishedAt
    )
    .sort((a, b) => a.publishedAt!.getTime() - b.publishedAt!.getTime());

  if (published.length < 2) return 0;

  const values = published.map((row) => (row.manualGrade! / row.maxGrade!) * 100);
  const splitIndex = Math.floor(values.length / 2);
  const left = values.slice(0, splitIndex);
  const right = values.slice(splitIndex);
  if (left.length === 0 || right.length === 0) return 0;

  return roundTo1(avg(right) - avg(left));
}

function calculateWeakQuestionTypes(rows: AnalyticsRow[]): WeakQuestionTypeStat[] {
  const counters = new Map<QuestionType, { low: number; total: number }>();

  for (const row of rows) {
    for (const score of row.itemScores) {
      const current = counters.get(score.type) ?? { low: 0, total: 0 };
      current.total += 1;
      if (score.ratio < 0.7) {
        current.low += 1;
      }
      counters.set(score.type, current);
    }
  }

  return [...counters.entries()]
    .map(([type, data]) => ({
      type,
      lowCount: data.low,
      total: data.total,
      lowRate: data.total > 0 ? roundTo1((data.low / data.total) * 100) : 0,
    }))
    .sort((a, b) => {
      if (b.lowRate !== a.lowRate) return b.lowRate - a.lowRate;
      return b.lowCount - a.lowCount;
    });
}

function calculateAiHelpUsage(rows: AnalyticsRow[]): AiHelpUsageStat {
  let allowed = 0;
  let blocked = 0;
  for (const row of rows) {
    for (const status of row.helpRequestStatuses) {
      if (status === "BLOCKED") blocked += 1;
      else allowed += 1;
    }
  }
  return { allowed, blocked, total: allowed + blocked };
}

function extractQuestionTypesByOrder(content: unknown): Map<number, QuestionType> {
  const mapping = new Map<number, QuestionType>();
  const obj = toRecord(content);
  const items = Array.isArray(obj?.items) ? obj.items : [];

  for (const rawItem of items) {
    const item = toRecord(rawItem);
    const type = typeof item?.type === "string" ? item.type : null;
    const order = typeof item?.order === "number" ? item.order : null;
    if (!type || order === null) continue;
    if (!VALID_QUESTION_TYPES.has(type as QuestionType)) continue;
    mapping.set(order, type as QuestionType);
  }

  return mapping;
}

function extractItemScores(opts: {
  aiRecommendation: unknown;
  autoCheckResult: unknown;
  itemTypesByOrder: Map<number, QuestionType>;
}): Array<{ type: QuestionType; ratio: number }> {
  const fromAi = extractScoresFromAiRecommendation(
    opts.aiRecommendation,
    opts.itemTypesByOrder
  );
  if (fromAi.length > 0) return fromAi;

  return extractScoresFromAutoCheck(opts.autoCheckResult, opts.itemTypesByOrder);
}

function extractScoresFromAiRecommendation(
  aiRecommendation: unknown,
  itemTypesByOrder: Map<number, QuestionType>
): Array<{ type: QuestionType; ratio: number }> {
  const root = toRecord(aiRecommendation);
  const items = Array.isArray(root?.items) ? root.items : [];
  const output: Array<{ type: QuestionType; ratio: number }> = [];

  for (const raw of items) {
    const item = toRecord(raw);
    const order = typeof item?.itemOrder === "number" ? item.itemOrder : null;
    const recommended = typeof item?.recommendedScore === "number" ? item.recommendedScore : null;
    const maxScore = typeof item?.maxScore === "number" ? item.maxScore : null;

    if (order === null || recommended === null || maxScore === null || maxScore <= 0) continue;
    const type = itemTypesByOrder.get(order);
    if (!type) continue;

    output.push({
      type,
      ratio: clamp(recommended / maxScore, 0, 1),
    });
  }

  return output;
}

function extractScoresFromAutoCheck(
  autoCheckResult: unknown,
  itemTypesByOrder: Map<number, QuestionType>
): Array<{ type: QuestionType; ratio: number }> {
  const root = toRecord(autoCheckResult);
  const items = Array.isArray(root?.items) ? root.items : [];
  const output: Array<{ type: QuestionType; ratio: number }> = [];

  for (const raw of items) {
    const item = toRecord(raw);
    const order = typeof item?.itemOrder === "number" ? item.itemOrder : null;
    const autoScore = typeof item?.autoScore === "number" ? item.autoScore : null;
    const maxScore = typeof item?.maxScore === "number" ? item.maxScore : null;
    if (order === null || autoScore === null || maxScore === null || maxScore <= 0) continue;
    const type = itemTypesByOrder.get(order);
    if (!type) continue;
    output.push({
      type,
      ratio: clamp(autoScore / maxScore, 0, 1),
    });
  }

  return output;
}

function resolveRecommendationStatus(opts: {
  overview: AnalyticsOverview;
  cacheStatus: string | null;
  recommendation: InsightRecommendation | null;
}): RecommendationStatus {
  if (opts.overview.publishedCount === 0) {
    return "INSUFFICIENT_DATA";
  }

  if (opts.cacheStatus === "QUEUED" || opts.cacheStatus === "PROCESSING") {
    return "PROCESSING";
  }
  if (opts.cacheStatus === "STALE") {
    return "STALE";
  }
  if (opts.cacheStatus === "FAILED") {
    return "FAILED";
  }

  if (!opts.recommendation) {
    return "STALE";
  }
  if (
    opts.recommendation.confidence === "LOW" ||
    opts.overview.publishedCount < MIN_RELIABLE_PUBLISHED
  ) {
    return "LOW_CONFIDENCE";
  }
  return "READY";
}

function parseRecommendationFromCache(raw: unknown): InsightRecommendation | null {
  const record = toRecord(raw);
  if (!record) return null;

  const summary = typeof record.summary === "string" ? record.summary : null;
  const improvementAreas = Array.isArray(record.improvementAreas)
    ? record.improvementAreas.filter((item): item is string => typeof item === "string")
    : [];
  const studyPlan = Array.isArray(record.studyPlan)
    ? record.studyPlan.filter((item): item is string => typeof item === "string")
    : [];
  const evidenceRefs = Array.isArray(record.evidenceRefs)
    ? record.evidenceRefs.filter((item): item is string => typeof item === "string")
    : [];
  const confidence = parseConfidence(record.confidence);
  const generatedAt =
    typeof record.generatedAt === "string"
      ? record.generatedAt
      : new Date().toISOString();

  if (!summary || !confidence) return null;

  return {
    summary,
    improvementAreas,
    studyPlan,
    confidence,
    evidenceRefs,
    generatedAt,
  };
}

async function buildRecommendation(opts: {
  learnerAccountId: string;
  teacherAccountId: string | null;
  subjectKey: string | null;
  overview: AnalyticsOverview;
  traceId: string;
}): Promise<InsightRecommendation> {
  if (opts.overview.publishedCount === 0) {
    return buildFallbackRecommendation(opts.overview);
  }

  const modelId = resolveAiModel({ scopedEnvKey: "AI_MODEL_ANALYTICS_INSIGHT" });
  const result = await aiGenerate({
    modelId,
    traceId: opts.traceId,
    label: "analytics.insight.summary",
    temperature: 0.2,
    maxTokens: 1200,
    messages: [
      {
        role: "system",
        content: [
          "You are an educational analytics assistant.",
          "Generate concise actionable recommendations for student improvement.",
          "Return only valid JSON and do not include markdown.",
          "Schema:",
          JSON.stringify({
            summary: "string",
            improvementAreas: ["string"],
            studyPlan: ["string"],
            confidenceValue: 0.7,
            evidenceRefs: ["string"],
          }),
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            learnerAccountId: opts.learnerAccountId,
            teacherAccountId: opts.teacherAccountId,
            subjectKey: opts.subjectKey,
            overview: opts.overview,
          },
          null,
          2
        ),
      },
    ],
  });

  const parsed = parseRecommendationResponse(result.text);
  if (!parsed) {
    return buildFallbackRecommendation(opts.overview);
  }

  return {
    summary: parsed.summary,
    improvementAreas: parsed.improvementAreas,
    studyPlan: parsed.studyPlan,
    confidence: confidenceLevel(parsed.confidenceValue, opts.overview.publishedCount),
    evidenceRefs: parsed.evidenceRefs,
    generatedAt: new Date().toISOString(),
  };
}

function parseRecommendationResponse(
  rawText: string
): z.infer<typeof recommendationSchema> | null {
  const candidates = buildJsonCandidates(rawText);
  for (const candidate of candidates) {
    try {
      let parsed = JSON.parse(candidate) as unknown;
      if (typeof parsed === "string") {
        parsed = JSON.parse(parsed) as unknown;
      }
      return recommendationSchema.parse(parsed);
    } catch {
      // next candidate
    }
  }
  return null;
}

function buildJsonCandidates(rawText: string): string[] {
  const trimmed = rawText.trim();
  const candidates: string[] = [];
  if (trimmed) candidates.push(trimmed);

  const fencedRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  for (const match of trimmed.matchAll(fencedRegex)) {
    const block = match[1]?.trim();
    if (block) candidates.push(block);
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  return Array.from(new Set(candidates));
}

function buildFallbackRecommendation(overview: AnalyticsOverview): InsightRecommendation {
  const weak =
    overview.weakQuestionTypes.length > 0
      ? overview.weakQuestionTypes[0].type.replace("_", " ").toLowerCase()
      : "mixed question types";

  return {
    summary:
      overview.publishedCount === 0
        ? "Not enough published results to provide a confident personalized recommendation."
        : `Focus on weak areas in "${weak}" and keep a consistent assignment completion pace.`,
    improvementAreas: [
      "Revise answers after each round of feedback.",
      "Review recurring mistakes before the next attempt.",
    ],
    studyPlan: [
      "Run 2-3 short weekly practice sessions on weak question types.",
      "After each published result, log 1-2 mistakes and how to fix them.",
    ],
    confidence:
      overview.publishedCount >= MIN_RELIABLE_PUBLISHED ? "MEDIUM" : "LOW",
    evidenceRefs: [
      `publishedCount=${overview.publishedCount}`,
      `completionRate=${overview.completionRate}`,
      `avgPercent=${overview.avgPercent ?? "n/a"}`,
    ],
    generatedAt: new Date().toISOString(),
  };
}

function confidenceLevel(
  confidenceValue: number,
  publishedCount: number
): "HIGH" | "MEDIUM" | "LOW" {
  const adjusted = confidenceValue - Math.max(0, MIN_RELIABLE_PUBLISHED - publishedCount) * 0.1;
  if (adjusted >= 0.75) return "HIGH";
  if (adjusted >= 0.45) return "MEDIUM";
  return "LOW";
}

function parseConfidence(value: unknown): "HIGH" | "MEDIUM" | "LOW" | null {
  if (value === "HIGH" || value === "MEDIUM" || value === "LOW") return value;
  return null;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function roundTo1(value: number): number {
  return Math.round(value * 10) / 10;
}
