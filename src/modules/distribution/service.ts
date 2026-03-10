import { prisma } from "@/lib/db/prisma";
import { NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import { validateDistributionMode } from "@/modules/ai-help/policy-engine";
import type {
  AssignableStudentSummary,
  CreateDistributionOpts,
  DistributionDetail,
  DistributionSummary,
  RecipientSummary,
  StudentAssignmentSummary,
} from "./types";

// ── Create ────────────────────────────────────────────────────────────────

export async function createDistribution(
  opts: CreateDistributionOpts
): Promise<DistributionDetail> {
  const {
    assignmentId,
    versionId,
    teacherId,
    deadline,
    distributionStatus,
    isGraded,
    aiHelpMode,
    recipientStudentIds,
  } = opts;

  // Verify assignment belongs to teacher and is in a distributable state
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new NotFoundError("Assignment not found");
  if (assignment.teacherId !== teacherId) throw new ForbiddenError();
  if (assignment.status !== "PUBLISHABLE" && assignment.status !== "ASSIGNED") {
    throw new ValidationError("Only PUBLISHABLE or ASSIGNED assignments can be distributed");
  }

  // Verify the version belongs to this assignment
  const version = await prisma.assignmentVersion.findUnique({ where: { id: versionId } });
  if (!version || version.assignmentId !== assignmentId) {
    throw new NotFoundError("Version not found on this assignment");
  }

  // Validate AI mode for mandatory graded assignments
  const modeCheck = validateDistributionMode(
    aiHelpMode,
    distributionStatus === "MANDATORY",
    isGraded
  );
  if (!modeCheck.valid) {
    throw new ValidationError(modeCheck.reason!);
  }

  // Verify all recipient students exist and have STUDENT role
  if (recipientStudentIds.length === 0) {
    throw new ValidationError("At least one recipient is required");
  }
  const students = await prisma.user.findMany({
    where: { id: { in: recipientStudentIds }, role: "STUDENT" },
    select: { id: true },
  });
  if (students.length !== recipientStudentIds.length) {
    throw new ValidationError("One or more recipient IDs are invalid or not students");
  }

  const distribution = await prisma.$transaction(async (tx) => {
    // Transition assignment to ASSIGNED if it's still PUBLISHABLE
    if (assignment.status === "PUBLISHABLE") {
      await tx.assignment.update({
        where: { id: assignmentId },
        data: { status: "ASSIGNED" },
      });
    }

    const dist = await tx.assignmentDistribution.create({
      data: {
        assignmentId,
        versionId,
        teacherId,
        deadline: deadline ?? null,
        status: distributionStatus,
        isGraded,
        aiHelpMode,
        recipients: {
          create: recipientStudentIds.map((studentId) => ({ studentId })),
        },
      },
      include: {
        recipients: true,
        assignment: { select: { title: true } },
      },
    });

    return dist;
  });

  return toDetail(distribution, distribution.recipients, distribution.assignment.title);
}

// ── Read (Teacher) ─────────────────────────────────────────────────────────

export async function listDistributions(teacherId: string): Promise<DistributionSummary[]> {
  const rows = await prisma.assignmentDistribution.findMany({
    where: { teacherId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toSummary);
}

export async function listAssignableStudents(): Promise<AssignableStudentSummary[]> {
  return prisma.user.findMany({
    where: { role: "STUDENT", isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
}

export async function getDistribution(
  id: string,
  teacherId: string
): Promise<DistributionDetail> {
  const row = await prisma.assignmentDistribution.findUnique({
    where: { id },
    include: {
      recipients: { orderBy: { createdAt: "asc" } },
      assignment: { select: { title: true } },
    },
  });
  if (!row) throw new NotFoundError("Distribution not found");
  if (row.teacherId !== teacherId) throw new ForbiddenError();
  return toDetail(row, row.recipients, row.assignment.title);
}

// ── Read (Student) ─────────────────────────────────────────────────────────

export async function listStudentAssignments(
  studentId: string
): Promise<StudentAssignmentSummary[]> {
  const recipients = await prisma.assignmentRecipient.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    include: {
      distribution: {
        include: {
          assignment: { select: { title: true } },
          teacher: { select: { name: true } },
        },
      },
      attempt: { select: { status: true } },
    },
  });

  return recipients.map((r) => ({
    recipientId: r.id,
    distributionId: r.distributionId,
    assignmentTitle: r.distribution.assignment.title,
    deadline: r.distribution.deadline,
    distributionStatus: r.distribution.status as "MANDATORY" | "PRACTICE",
    isGraded: r.distribution.isGraded,
    aiHelpMode: r.distribution.aiHelpMode as "NO_HELP" | "CLARIFICATION" | "GUIDED" | "POST_ASSESSMENT",
    recipientStatus: r.status as "PENDING" | "ACTIVE" | "SUBMITTED",
    attemptStatus: r.attempt ? (r.attempt.status as "DRAFT" | "SUBMITTED") : null,
    teacherName: r.distribution.teacher.name,
  }));
}

// ── Helpers ────────────────────────────────────────────────────────────────

type DistRow = {
  id: string;
  assignmentId: string;
  versionId: string;
  teacherId: string;
  deadline: Date | null;
  status: string;
  isGraded: boolean;
  aiHelpMode: string;
  createdAt: Date;
  updatedAt: Date;
};

type RecipientRow = {
  id: string;
  studentId: string;
  status: string;
  createdAt: Date;
};

function toSummary(row: DistRow): DistributionSummary {
  return {
    id: row.id,
    assignmentId: row.assignmentId,
    versionId: row.versionId,
    teacherId: row.teacherId,
    deadline: row.deadline,
    status: row.status as "MANDATORY" | "PRACTICE",
    isGraded: row.isGraded,
    aiHelpMode: row.aiHelpMode as "NO_HELP" | "CLARIFICATION" | "GUIDED" | "POST_ASSESSMENT",
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRecipientSummary(r: RecipientRow): RecipientSummary {
  return {
    id: r.id,
    studentId: r.studentId,
    status: r.status as "PENDING" | "ACTIVE" | "SUBMITTED",
    createdAt: r.createdAt,
  };
}

function toDetail(
  row: DistRow,
  recipients: RecipientRow[],
  assignmentTitle: string
): DistributionDetail {
  return {
    ...toSummary(row),
    recipients: recipients.map(toRecipientSummary),
    assignmentTitle,
  };
}
