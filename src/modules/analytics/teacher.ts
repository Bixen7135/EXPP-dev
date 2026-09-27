import { prisma } from "@/lib/db/prisma";
import type {
  AnalyticsPeriod,
  TeacherStudentInsight,
} from "./insight-service";
import {
  listTeacherStudentInsights,
  normalizeSubjectKey,
  resolveSubjectFromAssignmentContext,
} from "./insight-service";

export interface DistributionStats {
  distributionId: string;
  assignmentTitle: string;
  subjectKey: string;
  subjectLabel: string;
  aiHelpMode: string;
  isGraded: boolean;
  distributionStatus: string;
  deadline: Date | null;
  createdAt: Date;
  totalRecipients: number;
  notStarted: number;
  started: number;
  submitted: number;
  aiHelpAllowed: number;
  aiHelpBlocked: number;
  publishedResults: number;
}

export interface TeacherAnalytics {
  creatorAccountId: string;
  activeSubject: string | null;
  subjectOptions: Array<{ key: string; label: string }>;
  distributions: DistributionStats[];
  students: TeacherStudentInsight[];
  totals: {
    distributions: number;
    recipients: number;
    submitted: number;
    publishedResults: number;
    aiHelpAllowed: number;
    aiHelpBlocked: number;
  };
}

export async function getTeacherAnalytics(
  creatorAccountId: string,
  opts?: {
    subject?: string | null;
    period?: AnalyticsPeriod;
  }
): Promise<TeacherAnalytics> {
  const activeSubject = normalizeSubjectKey(opts?.subject);
  const period = opts?.period ?? "all_time";

  const distributions = await prisma.assignmentDistribution.findMany({
    where: { creatorAccountId },
    include: {
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
      recipients: {
        include: {
          attempt: {
            include: {
              helpRequests: { select: { status: true } },
              assessment: { select: { status: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const stats: DistributionStats[] = distributions.map((distribution) => {
    const notStarted = distribution.recipients.filter((row) => row.status === "PENDING").length;
    const started = distribution.recipients.filter((row) => row.status === "ACTIVE").length;
    const submitted = distribution.recipients.filter((row) => row.status === "SUBMITTED").length;

    let aiHelpAllowed = 0;
    let aiHelpBlocked = 0;
    let publishedResults = 0;

    for (const recipient of distribution.recipients) {
      if (recipient.attempt) {
        for (const helpRequest of recipient.attempt.helpRequests) {
          if (helpRequest.status === "ALLOWED") aiHelpAllowed += 1;
          else aiHelpBlocked += 1;
        }
        if (recipient.attempt.assessment?.status === "PUBLISHED") publishedResults += 1;
      }
    }

    const assignmentTags = Array.isArray(distribution.assignment.tags)
      ? distribution.assignment.tags
      : [];
    const subject = resolveSubjectFromAssignmentContext({
      tags: assignmentTags.map((tag) => ({
        key: tag.key,
        value: tag.value,
      })),
      generationConstraints:
        distribution.assignment.generationResult?.request.constraints ?? null,
    });

    return {
      distributionId: distribution.id,
      assignmentTitle: distribution.assignment.title,
      subjectKey: subject.subjectKey,
      subjectLabel: subject.subjectLabel,
      aiHelpMode: distribution.aiHelpMode,
      isGraded: distribution.isGraded,
      distributionStatus: distribution.status,
      deadline: distribution.deadline,
      createdAt: distribution.createdAt,
      totalRecipients: distribution.recipients.length,
      notStarted,
      started,
      submitted,
      aiHelpAllowed,
      aiHelpBlocked,
      publishedResults,
    };
  });

  const subjectOptions = Array.from(
    new Map(stats.map((item) => [item.subjectKey, item.subjectLabel])).entries()
  ).map(([key, label]) => ({ key, label }));

  const filteredDistributions = activeSubject
    ? stats.filter((item) => item.subjectKey === activeSubject)
    : stats;

  const totals = filteredDistributions.reduce(
    (acc, distribution) => ({
      distributions: acc.distributions + 1,
      recipients: acc.recipients + distribution.totalRecipients,
      submitted: acc.submitted + distribution.submitted,
      publishedResults: acc.publishedResults + distribution.publishedResults,
      aiHelpAllowed: acc.aiHelpAllowed + distribution.aiHelpAllowed,
      aiHelpBlocked: acc.aiHelpBlocked + distribution.aiHelpBlocked,
    }),
    { distributions: 0, recipients: 0, submitted: 0, publishedResults: 0, aiHelpAllowed: 0, aiHelpBlocked: 0 }
  );

  const students = await listTeacherStudentInsights({
    teacherAccountId: creatorAccountId,
    subject: activeSubject,
    period,
  });

  return {
    creatorAccountId,
    activeSubject,
    subjectOptions,
    distributions: filteredDistributions,
    students,
    totals,
  };
}
