import { prisma } from "@/lib/db/prisma";

export interface DistributionStats {
  distributionId: string;
  assignmentTitle: string;
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
  teacherId: string;
  distributions: DistributionStats[];
  totals: {
    distributions: number;
    recipients: number;
    submitted: number;
    publishedResults: number;
    aiHelpAllowed: number;
    aiHelpBlocked: number;
  };
}

export async function getTeacherAnalytics(teacherId: string): Promise<TeacherAnalytics> {
  const distributions = await prisma.assignmentDistribution.findMany({
    where: { teacherId },
    include: {
      assignment: { select: { title: true } },
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

  const stats: DistributionStats[] = distributions.map((d) => {
    const notStarted = d.recipients.filter((r) => r.status === "PENDING").length;
    const started = d.recipients.filter((r) => r.status === "ACTIVE").length;
    const submitted = d.recipients.filter((r) => r.status === "SUBMITTED").length;

    let aiHelpAllowed = 0;
    let aiHelpBlocked = 0;
    let publishedResults = 0;

    for (const r of d.recipients) {
      if (r.attempt) {
        for (const hr of r.attempt.helpRequests) {
          if (hr.status === "ALLOWED") aiHelpAllowed++;
          else aiHelpBlocked++;
        }
        if (r.attempt.assessment?.status === "PUBLISHED") publishedResults++;
      }
    }

    return {
      distributionId: d.id,
      assignmentTitle: d.assignment.title,
      aiHelpMode: d.aiHelpMode,
      isGraded: d.isGraded,
      distributionStatus: d.status,
      deadline: d.deadline,
      createdAt: d.createdAt,
      totalRecipients: d.recipients.length,
      notStarted,
      started,
      submitted,
      aiHelpAllowed,
      aiHelpBlocked,
      publishedResults,
    };
  });

  const totals = stats.reduce(
    (acc, d) => ({
      distributions: acc.distributions + 1,
      recipients: acc.recipients + d.totalRecipients,
      submitted: acc.submitted + d.submitted,
      publishedResults: acc.publishedResults + d.publishedResults,
      aiHelpAllowed: acc.aiHelpAllowed + d.aiHelpAllowed,
      aiHelpBlocked: acc.aiHelpBlocked + d.aiHelpBlocked,
    }),
    { distributions: 0, recipients: 0, submitted: 0, publishedResults: 0, aiHelpAllowed: 0, aiHelpBlocked: 0 }
  );

  return { teacherId, distributions: stats, totals };
}
