import { prisma } from "@/lib/db/prisma";
import { NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import { validateDistributionMode } from "@/modules/ai-help/policy-engine";
import type {
  AssignableStudentSummary,
  CreateDistributionOpts,
  DistributionDetail,
  DistributionSummary,
  RecipientSourceInput,
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
    creatorUserId,
    deadline,
    distributionStatus,
    isGraded,
    aiHelpMode,
    recipientSources = [],
    recipientUserIds = [],
    includeUserIds = [],
    excludeUserIds = [],
  } = opts;

  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
  if (!assignment) throw new NotFoundError("Assignment not found");
  if (assignment.ownerAccountId !== creatorUserId) throw new ForbiddenError();
  if (assignment.status !== "PUBLISHABLE" && assignment.status !== "ASSIGNED") {
    throw new ValidationError("Only PUBLISHABLE or ASSIGNED assignments can be distributed");
  }

  const version = await prisma.assignmentVersion.findUnique({ where: { id: versionId } });
  if (!version || version.assignmentId !== assignmentId) {
    throw new NotFoundError("Version not found on this assignment");
  }

  const modeCheck = validateDistributionMode(
    aiHelpMode,
    distributionStatus === "MANDATORY",
    isGraded
  );
  if (!modeCheck.valid) {
    throw new ValidationError(modeCheck.reason!);
  }

  const resolvedRecipientUserIds = await resolveRecipientUserIds({
    recipientSources,
    recipientUserIds,
    includeUserIds,
    excludeUserIds,
  });

  if (resolvedRecipientUserIds.length === 0) {
    throw new ValidationError("At least one recipient is required after source resolution");
  }

  const users = await prisma.account.findMany({
    where: { id: { in: resolvedRecipientUserIds }, isActive: true },
    select: { id: true },
  });
  if (users.length !== resolvedRecipientUserIds.length) {
    throw new ValidationError("One or more recipient user IDs are invalid or inactive");
  }

  const distribution = await prisma.$transaction(async (tx) => {
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
        creatorAccountId: creatorUserId,
        organizationId: assignment.organizationId,
        institutionId: assignment.institutionId,
        deadline: deadline ?? null,
        status: distributionStatus,
        isGraded,
        aiHelpMode,
        recipientSources: {
          create: recipientSources.map((source) => ({
            sourceType: source.sourceType,
            sourceRefId: source.sourceRefId ?? null,
          })),
        },
        recipients: {
          create: resolvedRecipientUserIds.map((recipientUserId) => ({
            recipientAccountId: recipientUserId,
            snapshotContext: {
              resolvedAt: new Date().toISOString(),
              resolver: "distribution.service",
            },
          })),
        },
      },
      include: {
        recipients: {
          include: {
            recipientAccount: {
              include: { user: { select: { email: true } } },
            },
          },
        },
        assignment: { select: { title: true } },
      },
    });

    return dist;
  });

  return toDetail(distribution, distribution.recipients, distribution.assignment.title);
}

// ── Read (Creator) ────────────────────────────────────────────────────────

export async function listDistributions(
  creatorUserId: string
): Promise<DistributionSummary[]> {
  const rows = await prisma.assignmentDistribution.findMany({
    where: { creatorAccountId: creatorUserId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toSummary);
}

export async function listAssignableStudents(
  organizationId?: string | null
): Promise<AssignableStudentSummary[]> {
  const accounts = await prisma.account.findMany({
    where: {
      isActive: true,
      ...(organizationId ? { organizationId } : {}),
    },
    include: {
      user: { select: { email: true } },
    },
    orderBy: [{ displayName: "asc" }, { createdAt: "asc" }],
  });

  return accounts.map((account) => ({
    id: account.id,
    name: account.displayName,
    email: account.user.email,
    domain: account.domain,
    organizationId: account.organizationId,
  }));
}

export async function getDistribution(
  id: string,
  creatorUserId: string
): Promise<DistributionDetail> {
  const row = await prisma.assignmentDistribution.findUnique({
    where: { id },
    include: {
      recipients: {
        include: {
          recipientAccount: {
            include: { user: { select: { email: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      assignment: { select: { title: true } },
    },
  });
  if (!row) throw new NotFoundError("Distribution not found");
  if (row.creatorAccountId !== creatorUserId) throw new ForbiddenError();
  return toDetail(row, row.recipients, row.assignment.title);
}

// ── Read (Recipient) ───────────────────────────────────────────────────────

export async function listStudentAssignments(
  recipientUserId: string
): Promise<StudentAssignmentSummary[]> {
  const recipients = await prisma.assignmentRecipient.findMany({
    where: { recipientAccountId: recipientUserId },
    orderBy: { createdAt: "desc" },
    include: {
      distribution: {
        include: {
          assignment: { select: { title: true } },
          creatorAccount: { select: { displayName: true } },
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
    creatorName: r.distribution.creatorAccount.displayName,
  }));
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function resolveRecipientUserIds(opts: {
  recipientSources: RecipientSourceInput[];
  recipientUserIds: string[];
  includeUserIds: string[];
  excludeUserIds: string[];
}): Promise<string[]> {
  const selected = new Set<string>(opts.recipientUserIds);

  for (const source of opts.recipientSources) {
    if (source.sourceType === "USER" && source.sourceRefId) {
      selected.add(source.sourceRefId);
      continue;
    }

    if (!source.sourceRefId) continue;

    if (source.sourceType === "FORMAL_ENTITY") {
      const members = await prisma.formalEntityMember.findMany({
        where: { formalEntityId: source.sourceRefId },
        select: { accountId: true },
      });
      for (const member of members) selected.add(member.accountId);
      continue;
    }

    if (source.sourceType === "TARGET_GROUP") {
      const members = await prisma.targetGroupMember.findMany({
        where: { targetGroupId: source.sourceRefId },
        select: { accountId: true },
      });
      for (const member of members) selected.add(member.accountId);
      continue;
    }

    if (source.sourceType === "PRACTICE_GROUP") {
      const members = await prisma.practiceGroupMember.findMany({
        where: { practiceGroupId: source.sourceRefId },
        select: { accountId: true },
      });
      for (const member of members) selected.add(member.accountId);
    }
  }

  for (const userId of opts.includeUserIds) selected.add(userId);
  for (const userId of opts.excludeUserIds) selected.delete(userId);

  return [...selected];
}

type DistRow = {
  id: string;
  assignmentId: string;
  versionId: string;
  creatorAccountId: string;
  deadline: Date | null;
  status: string;
  isGraded: boolean;
  aiHelpMode: string;
  createdAt: Date;
  updatedAt: Date;
};

type RecipientRow = {
  id: string;
  recipientAccountId: string;
  status: string;
  createdAt: Date;
  recipientAccount?: { displayName: string } | null;
};

function toSummary(row: DistRow): DistributionSummary {
  return {
    id: row.id,
    assignmentId: row.assignmentId,
    versionId: row.versionId,
    creatorUserId: row.creatorAccountId,
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
    recipientUserId: r.recipientAccountId,
    recipientDisplayName: r.recipientAccount?.displayName ?? r.recipientAccountId,
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
