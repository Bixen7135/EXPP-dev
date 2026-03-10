import { prisma } from "@/lib/db/prisma";
import { NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import type { AssignmentContent } from "@/modules/assignments/types";
import { toStudentContent, type AttemptAnswer, type AttemptDetail } from "./types";

// â”€â”€ Get or Create Attempt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getOrCreateAttempt(
  recipientId: string,
  studentId: string
): Promise<AttemptDetail> {
  const recipient = await prisma.assignmentRecipient.findUnique({
    where: { id: recipientId },
    include: {
      distribution: {
        include: {
          version: { select: { content: true } },
        },
      },
      attempt: true,
    },
  });

  if (!recipient) throw new NotFoundError("Recipient record not found");
  if (recipient.studentId !== studentId) throw new ForbiddenError();

  let attempt = recipient.attempt;

  if (!attempt) {
    // First access â€” create the attempt and mark recipient as ACTIVE
    attempt = await prisma.$transaction(async (tx) => {
      const created = await tx.attempt.create({
        data: { recipientId, studentId, answers: [], status: "DRAFT" },
      });
      await tx.assignmentRecipient.update({
        where: { id: recipientId },
        data: { status: "ACTIVE" },
      });
      return created;
    });
  }

  return buildAttemptDetail(attempt, recipient.distribution);
}

// â”€â”€ Save Draft â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function saveDraft(
  attemptId: string,
  studentId: string,
  answers: AttemptAnswer[]
): Promise<AttemptDetail> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      recipient: {
        include: {
          distribution: { include: { version: { select: { content: true } } } },
        },
      },
    },
  });

  if (!attempt) throw new NotFoundError("Attempt not found");
  if (attempt.studentId !== studentId) throw new ForbiddenError();
  if (attempt.status === "SUBMITTED") {
    throw new ValidationError("Cannot edit a submitted attempt");
  }

  const updated = await prisma.attempt.update({
    where: { id: attemptId },
    data: { answers: answers as object[] },
    include: {
      recipient: {
        include: {
          distribution: { include: { version: { select: { content: true } } } },
        },
      },
    },
  });

  return buildAttemptDetail(updated, updated.recipient.distribution);
}

// â”€â”€ Submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function submitAttempt(
  attemptId: string,
  studentId: string
): Promise<AttemptDetail> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      recipient: {
        include: {
          distribution: { include: { version: { select: { content: true } } } },
        },
      },
    },
  });

  if (!attempt) throw new NotFoundError("Attempt not found");
  if (attempt.studentId !== studentId) throw new ForbiddenError();
  if (attempt.status === "SUBMITTED") {
    throw new ValidationError("Attempt has already been submitted");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const submitted = await tx.attempt.update({
      where: { id: attemptId },
      data: { status: "SUBMITTED", submittedAt: new Date() },
      include: {
        recipient: {
          include: {
            distribution: { include: { version: { select: { content: true } } } },
          },
        },
      },
    });
    await tx.assignmentRecipient.update({
      where: { id: submitted.recipientId },
      data: { status: "SUBMITTED" },
    });
    return submitted;
  });

  return buildAttemptDetail(updated, updated.recipient.distribution);
}

// â”€â”€ Get Single Attempt â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function getAttempt(
  attemptId: string,
  studentId: string
): Promise<AttemptDetail> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      recipient: {
        include: {
          distribution: { include: { version: { select: { content: true } } } },
        },
      },
    },
  });

  if (!attempt) throw new NotFoundError("Attempt not found");
  if (attempt.studentId !== studentId) throw new ForbiddenError();

  return buildAttemptDetail(attempt, attempt.recipient.distribution);
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type AttemptRow = {
  id: string;
  recipientId: string;
  studentId: string;
  answers: unknown;
  status: string;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type DistributionContext = {
  aiHelpMode: string;
  deadline: Date | null;
  isGraded: boolean;
  status: string;
  version: { content: unknown };
};

function buildAttemptDetail(row: AttemptRow, dist: DistributionContext): AttemptDetail {
  const fullContent = dist.version.content as unknown as AssignmentContent;
  return {
    id: row.id,
    recipientId: row.recipientId,
    studentId: row.studentId,
    status: row.status as "DRAFT" | "SUBMITTED",
    answers: (row.answers as unknown as AttemptAnswer[]) ?? [],
    submittedAt: row.submittedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    aiHelpMode: dist.aiHelpMode as "NO_HELP" | "CLARIFICATION" | "GUIDED" | "POST_ASSESSMENT",
    deadline: dist.deadline,
    isGraded: dist.isGraded,
    distributionStatus: dist.status as "MANDATORY" | "PRACTICE",
    assignmentContent: {
      title: fullContent.title,
      instructions: fullContent.instructions,
      items: toStudentContent(fullContent.items),
    },
  };
}


