import { prisma } from "@/lib/db/prisma";

export interface StudentAssignmentAnalytic {
  recipientId: string;
  distributionId: string;
  assignmentTitle: string;
  teacherName: string;
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
  studentId: string;
  assignments: StudentAssignmentAnalytic[];
  totals: {
    total: number;
    notStarted: number;
    inProgress: number;
    submitted: number;
    resultsPublished: number;
  };
}

export async function getStudentAnalytics(studentId: string): Promise<StudentAnalytics> {
  const recipients = await prisma.assignmentRecipient.findMany({
    where: { studentId },
    include: {
      distribution: {
        include: {
          assignment: { select: { title: true } },
          teacher: { select: { name: true } },
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

  const assignments: StudentAssignmentAnalytic[] = recipients.map((r) => {
    const attempt = r.attempt;
    const assessment = attempt?.assessment;
    const resultPublished = assessment?.status === "PUBLISHED";

    const grade = resultPublished ? (assessment?.manualGrade ?? null) : null;
    const maxGrade = resultPublished ? (assessment?.maxGrade ?? null) : null;
    const percentage =
      grade !== null && maxGrade !== null && maxGrade > 0
        ? Math.round((grade / maxGrade) * 100)
        : null;

    return {
      recipientId: r.id,
      distributionId: r.distributionId,
      assignmentTitle: r.distribution.assignment.title,
      teacherName: r.distribution.teacher.name,
      distributionStatus: r.distribution.status,
      isGraded: r.distribution.isGraded,
      aiHelpMode: r.distribution.aiHelpMode,
      deadline: r.distribution.deadline,
      recipientStatus: r.status,
      attemptStatus: attempt ? (attempt.status as "DRAFT" | "SUBMITTED") : null,
      grade,
      maxGrade,
      percentage,
      resultPublished,
    };
  });

  const totals = assignments.reduce(
    (acc, a) => ({
      total: acc.total + 1,
      notStarted: acc.notStarted + (a.recipientStatus === "PENDING" ? 1 : 0),
      inProgress: acc.inProgress + (a.recipientStatus === "ACTIVE" ? 1 : 0),
      submitted: acc.submitted + (a.recipientStatus === "SUBMITTED" ? 1 : 0),
      resultsPublished: acc.resultsPublished + (a.resultPublished ? 1 : 0),
    }),
    { total: 0, notStarted: 0, inProgress: 0, submitted: 0, resultsPublished: 0 }
  );

  return { studentId, assignments, totals };
}
