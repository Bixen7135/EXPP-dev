import { prisma } from "@/lib/db/prisma";
import { NotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";
import type {
  AssignmentContent,
  RubricCriterion,
  AssignmentStatus,
  AssignmentSummary,
  AssignmentDetail,
  AssignmentVersionSummary,
  AssignmentVersionDetail,
} from "./types";

// â”€â”€ Create â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function createAssignment(opts: {
  ownerAccountId: string;
  generationResultId: string;
}): Promise<AssignmentDetail> {
  const { ownerAccountId, generationResultId } = opts;

  // Verify the generation result exists and belongs to this teacher
  const genResult = await prisma.generationResult.findUnique({
    where: { id: generationResultId },
    include: { request: true },
  });
  if (!genResult) throw new NotFoundError("Generation result not found");
  if (genResult.request.ownerAccountId !== ownerAccountId) throw new ForbiddenError();

  // Derive initial content from the generation result
  const content = normalizeAssignmentContent(genResult.content as unknown as AssignmentContent);

  const assignment = await prisma.$transaction(async (tx) => {
    const created = await tx.assignment.create({
      data: {
        ownerAccountId,
        generationResultId,
        title: content.title,
        content: content as object,
        status: "DRAFT",
      },
    });

    // Create the initial version (v1)
    const version = await tx.assignmentVersion.create({
      data: {
        assignmentId: created.id,
        versionNumber: 1,
        content: content as object,
        authorAccountId: ownerAccountId,
        changeDescription: "Initial version from generation",
      },
    });

    // Sync items
    await syncItems(tx, created.id, content.items);

    // Set currentVersionId
    const updated = await tx.assignment.update({
      where: { id: created.id },
      data: { currentVersionId: version.id },
      include: { versions: true },
    });

    return updated;
  });

  return toDetail(assignment, assignment.versions.map(toVersionSummary));
}

// â”€â”€ Read â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listAssignments(
  ownerAccountId: string
): Promise<AssignmentSummary[]> {
  const rows = await prisma.assignment.findMany({
    where: { ownerAccountId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toSummary);
}

export async function getAssignment(
  id: string,
  ownerAccountId: string
): Promise<AssignmentDetail> {
  const row = await prisma.assignment.findUnique({
    where: { id },
    include: { versions: { orderBy: { versionNumber: "desc" } } },
  });
  if (!row) throw new NotFoundError("Assignment not found");
  if (row.ownerAccountId !== ownerAccountId) throw new ForbiddenError();
  return toDetail(row, row.versions.map(toVersionSummary));
}

export async function getAssignmentVersion(
  assignmentId: string,
  versionId: string,
  ownerAccountId: string
): Promise<AssignmentVersionDetail> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  });
  if (!assignment) throw new NotFoundError("Assignment not found");
  if (assignment.ownerAccountId !== ownerAccountId) throw new ForbiddenError();

  const version = await prisma.assignmentVersion.findUnique({
    where: { id: versionId },
  });
  if (!version || version.assignmentId !== assignmentId)
    throw new NotFoundError("Version not found");

  return {
    id: version.id,
    versionNumber: version.versionNumber,
    authorAccountId: version.authorAccountId,
    changeDescription: version.changeDescription,
    createdAt: version.createdAt,
    content: version.content as unknown as AssignmentContent,
  };
}

// â”€â”€ Update (creates a new version) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function updateAssignment(
  id: string,
  ownerAccountId: string,
  content: AssignmentContent,
  changeDescription?: string
): Promise<AssignmentDetail> {
  const normalizedContent = normalizeAssignmentContent(content);
  const assignment = await prisma.assignment.findUnique({ where: { id } });
  if (!assignment) throw new NotFoundError("Assignment not found");
  if (assignment.ownerAccountId !== ownerAccountId) throw new ForbiddenError();
  if (assignment.status === "ASSIGNED")
    throw new ValidationError("Cannot edit an assigned assignment");

  const updated = await prisma.$transaction(async (tx) => {
    // Count existing versions for the next number
    const count = await tx.assignmentVersion.count({
      where: { assignmentId: id },
    });

    const version = await tx.assignmentVersion.create({
      data: {
        assignmentId: id,
        versionNumber: count + 1,
        content: normalizedContent as object,
        authorAccountId: ownerAccountId,
        changeDescription: changeDescription ?? null,
      },
    });

    // Sync items to reflect the new version
    await syncItems(tx, id, normalizedContent.items);

    const result = await tx.assignment.update({
      where: { id },
      data: {
        title: normalizedContent.title,
        content: normalizedContent as object,
        currentVersionId: version.id,
        // If it was PUBLISHABLE and edited, revert to DRAFT (content changed)
        status: assignment.status === "PUBLISHABLE" ? "DRAFT" : assignment.status,
      },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    });

    return result;
  });

  return toDetail(updated, updated.versions.map(toVersionSummary));
}

// â”€â”€ Restore version â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function restoreVersion(
  assignmentId: string,
  versionId: string,
  ownerAccountId: string
): Promise<AssignmentDetail> {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  });
  if (!assignment) throw new NotFoundError("Assignment not found");
  if (assignment.ownerAccountId !== ownerAccountId) throw new ForbiddenError();
  if (assignment.status === "ASSIGNED")
    throw new ValidationError("Cannot restore a version on an assigned assignment");

  const version = await prisma.assignmentVersion.findUnique({
    where: { id: versionId },
  });
  if (!version || version.assignmentId !== assignmentId)
    throw new NotFoundError("Version not found");

  const content = normalizeAssignmentContent(version.content as unknown as AssignmentContent);

  const updated = await prisma.$transaction(async (tx) => {
    const count = await tx.assignmentVersion.count({
      where: { assignmentId },
    });

    const newVersion = await tx.assignmentVersion.create({
      data: {
        assignmentId,
        versionNumber: count + 1,
        content: content as object,
        authorAccountId: ownerAccountId,
        changeDescription: `Restored from version ${version.versionNumber}`,
      },
    });

    await syncItems(tx, assignmentId, content.items);

    const result = await tx.assignment.update({
      where: { id: assignmentId },
      data: {
        title: content.title,
        content: content as object,
        currentVersionId: newVersion.id,
        status: "DRAFT",
      },
      include: { versions: { orderBy: { versionNumber: "desc" } } },
    });

    return result;
  });

  return toDetail(updated, updated.versions.map(toVersionSummary));
}

// â”€â”€ Publish â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function publishAssignment(
  id: string,
  ownerAccountId: string
): Promise<AssignmentDetail> {
  const assignment = await prisma.assignment.findUnique({
    where: { id },
    include: { versions: { orderBy: { versionNumber: "desc" } } },
  });
  if (!assignment) throw new NotFoundError("Assignment not found");
  if (assignment.ownerAccountId !== ownerAccountId) throw new ForbiddenError();
  if (assignment.status === "ASSIGNED")
    throw new ValidationError("Assignment is already assigned");
  if (assignment.status === "PUBLISHABLE")
    throw new ValidationError("Assignment is already publishable");

  const updated = await prisma.assignment.update({
    where: { id },
    data: { status: "PUBLISHABLE" },
    include: { versions: { orderBy: { versionNumber: "desc" } } },
  });

  return toDetail(updated, updated.versions.map(toVersionSummary));
}

// â€”â€” Delete â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”â€”

export async function deleteAssignment(
  id: string,
  ownerAccountId: string
): Promise<void> {
  const assignment = await prisma.assignment.findUnique({
    where: { id },
  });
  if (!assignment) throw new NotFoundError("Assignment not found");
  if (assignment.ownerAccountId !== ownerAccountId) throw new ForbiddenError();
  if (assignment.status === "ASSIGNED")
    throw new ValidationError("Cannot delete an assigned assignment");

  await prisma.assignment.delete({
    where: { id },
  });
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

async function syncItems(
  tx: TxClient,
  assignmentId: string,
  items: AssignmentContent["items"]
): Promise<void> {
  await tx.assignmentItem.deleteMany({ where: { assignmentId } });
  if (items.length > 0) {
    await tx.assignmentItem.createMany({
      data: items.map((item) => ({
        assignmentId,
        order: item.order,
        type: item.type,
        question: ({
          text: item.question,
          options: item.options ?? [],
          rubricCriteria: item.rubricCriteria ?? [],
        } as object),
        expectedAnswer: ({
          text: item.expectedAnswer,
          maxScore: item.maxScore ?? 1,
        } as object),
      })),
    });
  }
}

type AssignmentRow = {
  id: string;
  ownerAccountId: string;
  generationResultId: string | null;
  title: string;
  content: unknown;
  status: string;
  currentVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type VersionRow = {
  id: string;
  versionNumber: number;
  authorAccountId: string;
  changeDescription: string | null;
  createdAt: Date;
};

function toSummary(row: AssignmentRow): AssignmentSummary {
  return {
    id: row.id,
    ownerAccountId: row.ownerAccountId,
    generationResultId: row.generationResultId,
    title: row.title,
    status: row.status as AssignmentStatus,
    currentVersionId: row.currentVersionId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toVersionSummary(v: VersionRow): AssignmentVersionSummary {
  return {
    id: v.id,
    versionNumber: v.versionNumber,
    authorAccountId: v.authorAccountId,
    changeDescription: v.changeDescription,
    createdAt: v.createdAt,
  };
}

function toDetail(
  row: AssignmentRow,
  versions: AssignmentVersionSummary[]
): AssignmentDetail {
  return {
    ...toSummary(row),
    content: normalizeAssignmentContent(row.content as unknown as AssignmentContent),
    versions,
  };
}

function normalizeAssignmentContent(content: AssignmentContent): AssignmentContent {
  return {
    ...content,
    items: content.items.map((item) => normalizeItem(item)),
  };
}

function normalizeItem(item: AssignmentContent["items"][number]): AssignmentContent["items"][number] {
  const maxScore = Number.isFinite(item.maxScore) && (item.maxScore ?? 0) > 0
    ? Number(item.maxScore)
    : 1;

  const rubricCriteria = normalizeRubricCriteria(
    item.rubricCriteria,
    maxScore,
    item.expectedAnswer
  );

  return {
    ...item,
    maxScore,
    rubricCriteria,
  };
}

function normalizeRubricCriteria(
  criteria: RubricCriterion[] | undefined,
  maxScore: number,
  expectedAnswer: string
): RubricCriterion[] {
  if (!Array.isArray(criteria) || criteria.length === 0) {
    return [
      {
        id: "criterion_main",
        title: "Expected answer coverage",
        description: expectedAnswer || "Answer should align with expected learning objective.",
        weight: maxScore,
        type: "EXPECTATION",
      },
    ];
  }

  const sanitized: RubricCriterion[] = criteria.map((criterion, idx) => ({
    id: criterion.id || `criterion_${idx + 1}`,
    title: criterion.title?.trim() || `Criterion ${idx + 1}`,
    description:
      criterion.description?.trim() ||
      "Demonstrates correct understanding relevant to the prompt.",
    weight:
      Number.isFinite(criterion.weight) && criterion.weight > 0
        ? Number(criterion.weight)
        : 0,
    type: criterion.type === "PENALTY" ? "PENALTY" : "EXPECTATION",
  }));

  const total = sanitized.reduce((sum, c) => sum + c.weight, 0);
  if (total <= 0) {
    return [
      {
        id: "criterion_main",
        title: "Expected answer coverage",
        description: expectedAnswer || "Answer should align with expected learning objective.",
        weight: maxScore,
        type: "EXPECTATION",
      },
    ];
  }

  const scale = maxScore / total;
  return sanitized.map((criterion): RubricCriterion => ({
    ...criterion,
    weight: Number((criterion.weight * scale).toFixed(2)),
  }));
}


