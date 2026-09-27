import { prisma } from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/errors";
import { deterministicEmbedding, ensureMaterialsIndexed, extractKeywords } from "@/modules/materials/indexing";
import type { GenerationItemSource } from "./types";

const MAX_CONTEXT_CHARS = 32_000;
const DEFAULT_RETRIEVAL_LIMIT = 16;

export interface InternalRetrievedChunk {
  chunkId: string;
  materialId: string;
  materialTitle: string;
  text: string;
  score: number;
  startOffset: number;
  endOffset: number;
  keywords: string[];
}

export interface InternalRetrievalInput {
  ownerAccountId: string;
  materialIds: string[];
  topic: string;
  materialHints?: string[];
  limit?: number;
}

export interface InternalRetrievalResult {
  chunks: InternalRetrievedChunk[];
  sources: GenerationItemSource[];
  contextText: string;
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function lexicalScore(queryKeywords: string[], chunkKeywords: string[]): number {
  if (queryKeywords.length === 0 || chunkKeywords.length === 0) return 0;

  const querySet = new Set(queryKeywords);
  const overlapCount = chunkKeywords.filter((word) => querySet.has(word)).length;
  return overlapCount / querySet.size;
}

function scoreChunk(opts: {
  queryEmbedding: number[];
  queryKeywords: string[];
  chunkEmbedding: number[];
  chunkKeywords: string[];
}): number {
  const vector = cosineSimilarity(opts.queryEmbedding, opts.chunkEmbedding);
  const lexical = lexicalScore(opts.queryKeywords, opts.chunkKeywords);
  return 0.65 * vector + 0.35 * lexical;
}

function normalizeEmbedding(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((value) => (typeof value === "number" && Number.isFinite(value) ? value : null))
    .filter((value): value is number => value !== null);
}

function buildContextText(chunks: InternalRetrievedChunk[]): string {
  const parts: string[] = [];
  let chars = 0;

  for (const chunk of chunks) {
    const part = `=== Material: ${chunk.materialTitle} [chunk:${chunk.chunkId}] ===\n${chunk.text}`;
    if (chars + part.length > MAX_CONTEXT_CHARS) break;
    parts.push(part);
    chars += part.length;
  }

  return parts.join("\n\n");
}

async function expandByKnowledgeGraph(opts: {
  ownerAccountId: string;
  materialIds: string[];
  topChunkIds: string[];
  excludedChunkIds: Set<string>;
  materialTitleById: Map<string, string>;
  limit: number;
}): Promise<InternalRetrievedChunk[]> {
  if (opts.topChunkIds.length === 0 || opts.limit <= 0) return [];

  const topChunkConceptLinks = await prisma.materialChunkConcept.findMany({
    where: {
      chunkId: { in: opts.topChunkIds },
    },
    select: {
      conceptId: true,
      score: true,
    },
  });

  const seedConceptIds = [...new Set(topChunkConceptLinks.map((link) => link.conceptId))];
  if (seedConceptIds.length === 0) return [];

  const relations = await prisma.knowledgeRelation.findMany({
    where: {
      ownerAccountId: opts.ownerAccountId,
      materialId: { in: opts.materialIds },
      OR: [
        { fromConceptId: { in: seedConceptIds } },
        { toConceptId: { in: seedConceptIds } },
      ],
    },
    orderBy: [{ weight: "desc" }, { updatedAt: "desc" }],
    take: 80,
    select: {
      fromConceptId: true,
      toConceptId: true,
      weight: true,
    },
  });

  const conceptWeights = new Map<string, number>();
  for (const relation of relations) {
    conceptWeights.set(
      relation.fromConceptId,
      (conceptWeights.get(relation.fromConceptId) ?? 0) + relation.weight
    );
    conceptWeights.set(
      relation.toConceptId,
      (conceptWeights.get(relation.toConceptId) ?? 0) + relation.weight
    );
  }

  const topConceptIds = [...conceptWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([conceptId]) => conceptId);

  if (topConceptIds.length === 0) return [];

  const conceptChunkLinks = await prisma.materialChunkConcept.findMany({
    where: {
      conceptId: { in: topConceptIds },
      chunk: {
        materialId: { in: opts.materialIds },
      },
    },
    select: {
      score: true,
      conceptId: true,
      chunk: {
        select: {
          id: true,
          materialId: true,
          text: true,
          startOffset: true,
          endOffset: true,
          keywords: true,
        },
      },
    },
    take: 120,
  });

  const byChunkId = new Map<string, InternalRetrievedChunk>();
  for (const link of conceptChunkLinks) {
    const chunkId = link.chunk.id;
    if (opts.excludedChunkIds.has(chunkId)) continue;

    const relationWeight = conceptWeights.get(link.conceptId) ?? 0;
    const score = 0.25 + relationWeight * 0.01 + link.score * 0.05;

    const existing = byChunkId.get(chunkId);
    if (existing && existing.score >= score) continue;

    byChunkId.set(chunkId, {
      chunkId,
      materialId: link.chunk.materialId,
      materialTitle: opts.materialTitleById.get(link.chunk.materialId) ?? "Material",
      text: link.chunk.text,
      score,
      startOffset: link.chunk.startOffset,
      endOffset: link.chunk.endOffset,
      keywords: link.chunk.keywords,
    });
  }

  return [...byChunkId.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.limit);
}

export async function retrieveInternalContext(
  input: InternalRetrievalInput
): Promise<InternalRetrievalResult> {
  if (input.materialIds.length === 0) {
    return {
      chunks: [],
      sources: [],
      contextText: "",
    };
  }

  const materials = await prisma.material.findMany({
    where: { id: { in: input.materialIds } },
    select: {
      id: true,
      ownerAccountId: true,
      title: true,
      status: true,
      indexStatus: true,
    },
  });

  for (const material of materials) {
    if (material.ownerAccountId !== input.ownerAccountId) {
      throw new ForbiddenError();
    }
  }

  const readyIds = input.materialIds.filter((materialId) => {
    const material = materials.find((item) => item.id === materialId);
    return material?.status === "READY";
  });

  if (readyIds.length === 0) {
    return {
      chunks: [],
      sources: [],
      contextText: "",
    };
  }

  await ensureMaterialsIndexed(readyIds, input.ownerAccountId);

  const chunks = await prisma.materialChunk.findMany({
    where: {
      materialId: { in: readyIds },
      ownerAccountId: input.ownerAccountId,
    },
    select: {
      id: true,
      materialId: true,
      text: true,
      startOffset: true,
      endOffset: true,
      embedding: true,
      keywords: true,
    },
  });

  if (chunks.length === 0) {
    return {
      chunks: [],
      sources: [],
      contextText: "",
    };
  }

  const queryText = [input.topic, ...(input.materialHints ?? [])].join(" ").trim();
  const queryEmbedding = deterministicEmbedding(queryText || input.topic);
  const queryKeywords = extractKeywords(queryText || input.topic, 24);

  const materialTitleById = new Map(
    materials.map((material) => [material.id, material.title])
  );

  const scored = chunks
    .map((chunk) => {
      const chunkEmbedding = normalizeEmbedding(chunk.embedding);
      const score = scoreChunk({
        queryEmbedding,
        queryKeywords,
        chunkEmbedding,
        chunkKeywords: chunk.keywords,
      });

      return {
        chunkId: chunk.id,
        materialId: chunk.materialId,
        materialTitle: materialTitleById.get(chunk.materialId) ?? "Material",
        text: chunk.text,
        score,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        keywords: chunk.keywords,
      } satisfies InternalRetrievedChunk;
    })
    .sort((a, b) => b.score - a.score);

  const limit = input.limit ?? DEFAULT_RETRIEVAL_LIMIT;
  const lexicalTop = scored.slice(0, limit);

  const graphExpanded = await expandByKnowledgeGraph({
    ownerAccountId: input.ownerAccountId,
    materialIds: readyIds,
    topChunkIds: lexicalTop.map((chunk) => chunk.chunkId),
    excludedChunkIds: new Set(lexicalTop.map((chunk) => chunk.chunkId)),
    materialTitleById,
    limit: Math.max(2, Math.floor(limit / 2)),
  });

  const merged = [...lexicalTop, ...graphExpanded]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const sources: GenerationItemSource[] = merged.map((chunk) => ({
    type: "INTERNAL",
    ref: `material:${chunk.materialId}:chunk:${chunk.chunkId}`,
    title: chunk.materialTitle,
    excerpt: chunk.text.slice(0, 280),
  }));

  return {
    chunks: merged,
    sources,
    contextText: buildContextText(merged),
  };
}

/**
 * Backward-compatible helper used by older planning/generation calls.
 */
export async function buildMaterialContext(
  materialIds: string[],
  ownerAccountId: string
): Promise<string> {
  const result = await retrieveInternalContext({
    ownerAccountId,
    materialIds,
    topic: "general",
    materialHints: [],
    limit: 12,
  });

  return result.contextText;
}
