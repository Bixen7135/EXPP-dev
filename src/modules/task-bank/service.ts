import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { normalizeMaxScoreByQuestionType } from "@/lib/question-scoring";
import type {
  CreateTaskBankItemInput,
  TaskBankItemContent,
  TaskBankItemSummary,
  TaskBankListFilters,
  TaskBankTag,
  UpdateTaskBankItemInput,
} from "./types";

const MAX_TITLE_LENGTH = 200;
const MAX_TAG_KEY_LENGTH = 64;
const MAX_TAG_VALUE_LENGTH = 255;
const VALID_TYPES = new Set(["SHORT_ANSWER", "MULTIPLE_CHOICE", "LONG_ANSWER"]);

type TaskBankRow = {
  id: string;
  ownerAccountId: string;
  title: string;
  content: unknown;
  createdAt: Date;
  updatedAt: Date;
  tags: Array<{ key: string; value: string }>;
};

export async function listTaskBankItems(
  ownerAccountId: string,
  filters: TaskBankListFilters = {}
): Promise<TaskBankItemSummary[]> {
  const normalizedTagKey = normalizeOptionalFilter(filters.tagKey);
  const normalizedTagValue = normalizeOptionalFilter(filters.tagValue);
  const normalizedSearch = normalizeOptionalFilter(filters.search)?.toLowerCase() ?? null;

  const rows = await prisma.taskBankItem.findMany({
    where: {
      ownerAccountId,
      ...(normalizedTagKey || normalizedTagValue
        ? {
            tags: {
              some: {
                ...(normalizedTagKey
                  ? { key: { contains: normalizedTagKey, mode: "insensitive" } }
                  : {}),
                ...(normalizedTagValue
                  ? { value: { contains: normalizedTagValue, mode: "insensitive" } }
                  : {}),
              },
            },
          }
        : {}),
    },
    include: { tags: true },
    orderBy: { updatedAt: "desc" },
  });

  const mapped = rows.map(toSummary);
  if (!normalizedSearch) return mapped;

  return mapped.filter((item) => {
    const tagsText = item.tags.map((tag) => `${tag.key}:${tag.value}`).join(" ");
    const optionsText = (item.content.options ?? []).join(" ");
    const text = `${item.title} ${item.content.question} ${item.content.expectedAnswer} ${optionsText} ${tagsText}`
      .toLowerCase();
    return text.includes(normalizedSearch);
  });
}

export async function getTaskBankItem(
  id: string,
  ownerAccountId: string
): Promise<TaskBankItemSummary> {
  const row = await prisma.taskBankItem.findUnique({
    where: { id },
    include: { tags: true },
  });
  if (!row) throw new NotFoundError("Task bank item not found");
  if (row.ownerAccountId !== ownerAccountId) throw new ForbiddenError();
  return toSummary(row);
}

export async function createTaskBankItem(
  input: CreateTaskBankItemInput
): Promise<TaskBankItemSummary> {
  const title = normalizeTitle(input.title);
  const content = normalizeContent(input.content);
  const tags = normalizeTags(input.tags ?? []);

  const row = await prisma.taskBankItem.create({
    data: {
      ownerAccountId: input.ownerAccountId,
      title,
      content: content as object,
      tags: { create: tags.map((tag) => ({ key: tag.key, value: tag.value })) },
    },
    include: { tags: true },
  });

  return toSummary(row);
}

export async function updateTaskBankItem(
  id: string,
  ownerAccountId: string,
  input: UpdateTaskBankItemInput
): Promise<TaskBankItemSummary> {
  const existing = await prisma.taskBankItem.findUnique({
    where: { id },
    include: { tags: true },
  });
  if (!existing) throw new NotFoundError("Task bank item not found");
  if (existing.ownerAccountId !== ownerAccountId) throw new ForbiddenError();

  const title = input.title !== undefined ? normalizeTitle(input.title) : undefined;
  const content =
    input.content !== undefined ? normalizeContent(input.content) : undefined;
  const tags = input.tags !== undefined ? normalizeTags(input.tags) : undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.taskBankItem.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(content !== undefined ? { content: content as object } : {}),
      },
      include: { tags: true },
    });

    if (tags !== undefined) {
      await tx.taskBankTag.deleteMany({ where: { taskBankItemId: id } });
      if (tags.length > 0) {
        await tx.taskBankTag.createMany({
          data: tags.map((tag) => ({
            taskBankItemId: id,
            key: tag.key,
            value: tag.value,
          })),
        });
      }

      return tx.taskBankItem.findUniqueOrThrow({
        where: { id },
        include: { tags: true },
      });
    }

    return row;
  });

  return toSummary(updated);
}

export async function deleteTaskBankItem(
  id: string,
  ownerAccountId: string
): Promise<void> {
  const existing = await prisma.taskBankItem.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Task bank item not found");
  if (existing.ownerAccountId !== ownerAccountId) throw new ForbiddenError();

  await prisma.taskBankItem.delete({ where: { id } });
}

function toSummary(row: TaskBankRow): TaskBankItemSummary {
  return {
    id: row.id,
    ownerAccountId: row.ownerAccountId,
    title: row.title,
    content: normalizeContent(row.content as TaskBankItemContent),
    tags: row.tags.map((tag) => ({ key: tag.key, value: tag.value })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeTitle(rawTitle: string): string {
  if (typeof rawTitle !== "string") {
    throw new ValidationError("title must be a string");
  }

  const title = rawTitle.trim();
  if (!title) throw new ValidationError("title is required");
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ValidationError(`title must be <= ${MAX_TITLE_LENGTH} characters`);
  }
  return title;
}

function normalizeContent(rawContent: TaskBankItemContent): TaskBankItemContent {
  if (!rawContent || typeof rawContent !== "object") {
    throw new ValidationError("content is required");
  }

  if (!VALID_TYPES.has(rawContent.type)) {
    throw new ValidationError("content.type is invalid");
  }

  const question = `${rawContent.question ?? ""}`.trim();
  if (!question) throw new ValidationError("content.question is required");

  const expectedAnswer = `${rawContent.expectedAnswer ?? ""}`.trim();
  if (!expectedAnswer) throw new ValidationError("content.expectedAnswer is required");

  const maxScore = normalizeMaxScoreByQuestionType(
    rawContent.type,
    typeof rawContent.maxScore === "number" ? rawContent.maxScore : undefined
  );

  const options = Array.isArray(rawContent.options)
    ? rawContent.options
        .map((option) => `${option ?? ""}`.trim())
        .filter(Boolean)
    : [];

  if (rawContent.type === "MULTIPLE_CHOICE" && options.length < 2) {
    throw new ValidationError(
      "content.options must contain at least two options for MULTIPLE_CHOICE"
    );
  }

  const rubricCriteria: NonNullable<TaskBankItemContent["rubricCriteria"]> =
    Array.isArray(rawContent.rubricCriteria)
      ? rawContent.rubricCriteria.map((criterion, idx) => ({
          id: criterion.id || `criterion_${idx + 1}`,
          title: criterion.title?.trim() || `Criterion ${idx + 1}`,
          description:
            criterion.description?.trim() ||
            "Demonstrates correct understanding relevant to the prompt.",
          weight: (() => {
            const rawWeight =
              typeof criterion.weight === "number" ? criterion.weight : NaN;
            return Number.isFinite(rawWeight) && rawWeight > 0
              ? Number(rawWeight)
              : 1;
          })(),
          type:
            criterion.type === "PENALTY"
              ? ("PENALTY" as const)
              : ("EXPECTATION" as const),
        }))
      : [
          {
            id: "criterion_main",
            title: "Expected answer coverage",
            description:
              expectedAnswer || "Answer should align with expected learning objective.",
            weight: maxScore,
            type: "EXPECTATION" as const,
          },
        ];

  return {
    type: rawContent.type,
    question,
    options: rawContent.type === "MULTIPLE_CHOICE" ? options : undefined,
    expectedAnswer,
    maxScore,
    rubricCriteria,
  };
}

function normalizeTags(tags: TaskBankTag[]): TaskBankTag[] {
  const dedup = new Set<string>();
  const normalized: TaskBankTag[] = [];

  for (const tag of tags) {
    const key = `${tag?.key ?? ""}`.trim();
    const value = `${tag?.value ?? ""}`.trim();
    if (!key || !value) {
      throw new ValidationError("tags must include key and value");
    }
    if (key.length > MAX_TAG_KEY_LENGTH) {
      throw new ValidationError(`tag key must be <= ${MAX_TAG_KEY_LENGTH} characters`);
    }
    if (value.length > MAX_TAG_VALUE_LENGTH) {
      throw new ValidationError(
        `tag value must be <= ${MAX_TAG_VALUE_LENGTH} characters`
      );
    }

    const signature = `${key.toLowerCase()}::${value.toLowerCase()}`;
    if (dedup.has(signature)) continue;
    dedup.add(signature);
    normalized.push({ key, value });
  }

  return normalized;
}

function normalizeOptionalFilter(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
