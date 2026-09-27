import { prisma } from "@/lib/db/prisma";
import type {
  AnalyticsOverview,
  AnalyticsPeriod,
  BreakdownBySubject,
  BreakdownByTeacher,
  InsightRecommendation,
  RecommendationStatus,
} from "./insight-service";
import {
  buildLearnerInsightView,
  resolveSubjectFromAssignmentContext,
} from "./insight-service";

export interface StudentAssignmentAnalytic {
  recipientId: string;
  distributionId: string;
  assignmentTitle: string;
  creatorId: string;
  creatorName: string;
  subjectKey: string;
  subjectLabel: string;
  distributionStatus: string;
  isGraded: boolean;
  aiHelpMode: string;
  deadline: Date | null;
  recipientStatus: string;
  attemptStatus: "DRAFT" | "SUBMITTED" | null;
  grade: number | null;
  maxGrade: number | null;
  percentage: number | null;
  resultPublished: boolean;
}

export interface StudentAnalytics {
  recipientAccountId: string;
  assignments: StudentAssignmentAnalytic[];
  totals: {
    total: number;
    notStarted: number;
    inProgress: number;
    submitted: number;
    resultsPublished: number;
  };
  overview: AnalyticsOverview;
  teacherBreakdown: BreakdownByTeacher[];
  subjectBreakdown: BreakdownBySubject[];
  recommendation: InsightRecommendation | null;
  recommendationStatus: RecommendationStatus;
  subjectFilterApplied: string | null;
}

export async function getStudentAnalytics(
  recipientAccountId: string,
  opts?: {
    teacherId?: string | null;
    subject?: string | null;
    period?: AnalyticsPeriod;
  }
): Promise<StudentAnalytics> {
  const recipients = await prisma.assignmentRecipient.findMany({
    where: { recipientAccountId },
    include: {
      distribution: {
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
          creatorAccount: { select: { id: true, displayName: true } },
        },
      },
      attempt: {
        include: {
          assessment: {
            select: { status: true, manualGrade: true, maxGrade: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const assignments: StudentAssignmentAnalytic[] = recipients.map((recipient) => {
    const attempt = recipient.attempt;
    const assessment = attempt?.assessment;
    const resultPublished = assessment?.status === "PUBLISHED";

    const grade = resultPublished ? (assessment?.manualGrade ?? null) : null;
    const maxGrade = resultPublished ? (assessment?.maxGrade ?? null) : null;
    const percentage =
      grade !== null && maxGrade !== null && maxGrade > 0
        ? Math.round((grade / maxGrade) * 100)
        : null;

    const assignmentTags = Array.isArray(recipient.distribution.assignment.tags)
      ? recipient.distribution.assignment.tags
      : [];
    const subject = resolveSubjectFromAssignmentContext({
      tags: assignmentTags.map((tag) => ({
        key: tag.key,
        value: tag.value,
      })),
      generationConstraints:
        recipient.distribution.assignment.generationResult?.request.constraints ?? null,
    });

    return {
      recipientId: recipient.id,
      distributionId: recipient.distributionId,
      assignmentTitle: recipient.distribution.assignment.title,
      creatorId: recipient.distribution.creatorAccount.id,
      creatorName: recipient.distribution.creatorAccount.displayName,
      subjectKey: subject.subjectKey,
      subjectLabel: subject.subjectLabel,
      distributionStatus: recipient.distribution.status,
      isGraded: recipient.distribution.isGraded,
      aiHelpMode: recipient.distribution.aiHelpMode,
      deadline: recipient.distribution.deadline,
      recipientStatus: recipient.status,
      attemptStatus: attempt ? (attempt.status as "DRAFT" | "SUBMITTED") : null,
      grade,
      maxGrade,
      percentage,
      resultPublished,
    };
  });

  const totals = assignments.reduce(
    (acc, item) => ({
      total: acc.total + 1,
      notStarted: acc.notStarted + (item.recipientStatus === "PENDING" ? 1 : 0),
      inProgress: acc.inProgress + (item.recipientStatus === "ACTIVE" ? 1 : 0),
      submitted: acc.submitted + (item.recipientStatus === "SUBMITTED" ? 1 : 0),
      resultsPublished: acc.resultsPublished + (item.resultPublished ? 1 : 0),
    }),
    { total: 0, notStarted: 0, inProgress: 0, submitted: 0, resultsPublished: 0 }
  );

  const insight = await buildLearnerInsightView({
    learnerAccountId: recipientAccountId,
    teacherId: opts?.teacherId ?? null,
    subject: opts?.subject ?? null,
    period: opts?.period ?? "all_time",
  });

  return {
    recipientAccountId,
    assignments,
    totals,
    overview: insight.overview,
    teacherBreakdown: insight.teacherBreakdown,
    subjectBreakdown: insight.subjectBreakdown,
    recommendation: insight.recommendation,
    recommendationStatus: insight.recommendationStatus,
    subjectFilterApplied: insight.subjectFilterApplied,
  };
}
