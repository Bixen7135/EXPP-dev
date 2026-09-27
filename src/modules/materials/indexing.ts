import { prisma } from "@/lib/db/prisma";
import { ValidationError } from "@/lib/errors";

const CHUNK_SIZE = 1200;
const CHUNK_OVERLAP = 200;
const EMBEDDING_DIM = 256;
const EMBEDDING_BATCH_SIZE = 32;
const CONCEPT_BATCH_SIZE = 10;
const MAX_KEYWORDS_PER_CHUNK = 10;

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "are",
  "was",
  "were",
  "you",
  "your",
  "have",
  "has",
  "had",
  "not",
  "but",
  "can",
  "will",
  "shall",
  "into",
  "about",
  "they",
  "them",
  "their",
  "its",
  "our",
  "out",
  "when",
  "where",
  "what",
  "how",
  "why",
  "which",
  "who",
  "also",
  "than",
  "then",
  "there",
  "here",
  "such",
  "using",
  "use",
  "used",
  "using",
  "between",
  "within",
  "because",
  "while",
  "during",
  "each",
  "every",
  "any",
  "all",
  "more",
  "most",
  "very",
  "some",
  "other",
  "over",
  "under",
  "into",
  "onto",
  "about",
  "???",
  "???",
  "???",
  "???",
  "???",
  "???",
  "???",
  "???",
  "??",
  "???",
  "???",
  "????",
  "????",
  "???",
  "????",
  "????",
  "?????",
  "???",
  "?????",
  "????",
  "???",
]);

export interface TextChunk {
  chunkIndex: number;
  text: string;
  startOffset: number;
  endOffset: number;
}

export interface IndexedChunk extends TextChunk {
  embedding: number[];
  keywords: string[];
}

export interface IndexingResult {
  materialId: string;
  chunkCount: number;
  conceptCount: number;
  relationCount: number;
}

export function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): TextChunk[] {
  const normalized = text.trim();
  if (!normalized) return [];

  const chunks: TextChunk[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(start + size, normalized.length);
    const slice = normalized.slice(start, end).trim();

    if (slice.length > 0) {
      chunks.push({
        chunkIndex: chunks.length,
        text: slice,
        startOffset: start,
        endOffset: end,
      });
    }

    if (end >= normalized.length) break;
    start = Math.max(0, end - overlap);
  }

  return chunks;
}

export function extractKeywords(input: string, limit = MAX_KEYWORDS_PER_CHUNK): string[] {
  const freq = new Map<string, number>();
  const tokens = input
    .toLowerCase()
    .split(/[^\p{L}\p{N}_-]+/u)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));

  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
}

function hashToken(token: string): number {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function deterministicEmbedding(text: string, dims = EMBEDDING_DIM): number[] {
  const vector = new Array<number>(dims).fill(0);
  const tokens = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}_-]+/u)
    .filter((token) => token.length > 1);

  if (tokens.length === 0) {
    return vector;
  }

  for (const token of tokens) {
    const hash = hashToken(token);
    const index = hash % dims;
    const signed = hash % 2 === 0 ? 1 : -1;
    vector[index] += signed;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) return vector;

  return vector.map((value) => Number((value / norm).toFixed(6)));
}

export async function embedTextsBatched(
  texts: string[],
  batchSize = EMBEDDING_BATCH_SIZE
): Promise<number[][]> {
  const result: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    result.push(...batch.map((text) => deterministicEmbedding(text)));
  }

  return result;
}

function extractConceptsFromChunk(chunkTextValue: string): string[] {
  return extractKeywords(chunkTextValue, 6);
}

function normalizeConceptName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function relationKey(fromConceptId: string, toConceptId: string, relationType: string): string {
  return `${fromConceptId}|${toConceptId}|${relationType}`;
}

export async function indexMaterial(materialId: string, ownerAccountId: string): Promise<IndexingResult> {
  const material = await prisma.material.findUnique({
    where: { id: materialId },
    select: {
      id: true,
      ownerAccountId: true,
      status: true,
      extractedText: true,
    },
  });

  if (!material || material.ownerAccountId !== ownerAccountId) {
    throw new ValidationError("Material not found for indexing");
  }

  if (material.status !== "READY" || !material.extractedText) {
    await prisma.material.update({
      where: { id: materialId },
      data: { indexStatus: "ERROR" },
    });
    throw new ValidationError("Material is not ready for indexing");
  }

  await prisma.material.update({
    where: { id: materialId },
    data: { indexStatus: "INDEXING" },
  });

  const chunks = chunkText(material.extractedText);
  if (chunks.length === 0) {
    await prisma.material.update({
      where: { id: materialId },
      data: { indexStatus: "ERROR" },
    });
    throw new ValidationError("Material has no indexable text");
  }

  const embeddings = await embedTextsBatched(chunks.map((chunk) => chunk.text));
  const indexedChunks: IndexedChunk[] = chunks.map((chunk, idx) => ({
    ...chunk,
    embedding: embeddings[idx] ?? deterministicEmbedding(chunk.text),
    keywords: extractKeywords(chunk.text),
  }));

  const conceptNamesByChunk: string[][] = [];
  for (let i = 0; i < indexedChunks.length; i += CONCEPT_BATCH_SIZE) {
    const batch = indexedChunks.slice(i, i + CONCEPT_BATCH_SIZE);
    conceptNamesByChunk.push(...batch.map((chunk) => extractConceptsFromChunk(chunk.text)));
  }

  const uniqueConceptNames = new Set<string>();
  for (const names of conceptNamesByChunk) {
    for (const name of names) {
      uniqueConceptNames.add(normalizeConceptName(name));
    }
  }

  try {
    const stats = await prisma.$transaction(async (tx) => {
      const existingChunks = await tx.materialChunk.findMany({
        where: { materialId },
        select: { id: true },
      });
      const existingConcepts = await tx.knowledgeConcept.findMany({
        where: { materialId },
        select: { id: true },
      });

      const existingChunkIds = existingChunks.map((chunk) => chunk.id);
      const existingConceptIds = existingConcepts.map((concept) => concept.id);

      if (existingChunkIds.length > 0) {
        await tx.materialChunkConcept.deleteMany({
          where: { chunkId: { in: existingChunkIds } },
        });
      }

      if (existingConceptIds.length > 0) {
        await tx.knowledgeRelation.deleteMany({
          where: {
            OR: [
              { fromConceptId: { in: existingConceptIds } },
              { toConceptId: { in: existingConceptIds } },
            ],
          },
        });
      } else {
        await tx.knowledgeRelation.deleteMany({ where: { materialId } });
      }

      await tx.materialChunk.deleteMany({ where: { materialId } });
      await tx.knowledgeConcept.deleteMany({ where: { materialId } });

      const conceptByNormalizedName = new Map<string, { id: string; name: string }>();
      for (const normalizedName of uniqueConceptNames) {
        const created = await tx.knowledgeConcept.create({
          data: {
            ownerAccountId,
            materialId,
            name: normalizedName,
            normalizedName,
          },
          select: {
            id: true,
            name: true,
            normalizedName: true,
          },
        });
        conceptByNormalizedName.set(created.normalizedName, {
          id: created.id,
          name: created.name,
        });
      }

      const createdChunks = [] as Array<{ id: string; chunkIndex: number }>;
      for (const chunk of indexedChunks) {
        const created = await tx.materialChunk.create({
          data: {
            materialId,
            ownerAccountId,
            chunkIndex: chunk.chunkIndex,
            text: chunk.text,
            startOffset: chunk.startOffset,
            endOffset: chunk.endOffset,
            embedding: chunk.embedding,
            keywords: chunk.keywords,
          },
          select: {
            id: true,
            chunkIndex: true,
          },
        });
        createdChunks.push(created);
      }

      for (const chunk of createdChunks) {
        const names = conceptNamesByChunk[chunk.chunkIndex] ?? [];
        for (const name of names) {
          const concept = conceptByNormalizedName.get(normalizeConceptName(name));
          if (!concept) continue;
          await tx.materialChunkConcept.create({
            data: {
              chunkId: chunk.id,
              conceptId: concept.id,
              score: 1,
            },
          });
        }
      }

      const relationMap = new Map<
        string,
        {
          fromConceptId: string;
          toConceptId: string;
          relationType: string;
          weight: number;
        }
      >();

      for (let idx = 0; idx < conceptNamesByChunk.length; idx += 1) {
        const concepts = conceptNamesByChunk[idx]
          .map((name) => conceptByNormalizedName.get(normalizeConceptName(name)))
          .filter((value): value is { id: string; name: string } => Boolean(value));

        for (let i = 0; i < concepts.length; i += 1) {
          for (let j = i + 1; j < concepts.length; j += 1) {
            const from = concepts[i];
            const to = concepts[j];
            const key = relationKey(from.id, to.id, "CO_OCCURS");
            const current = relationMap.get(key);
            relationMap.set(key, {
              fromConceptId: from.id,
              toConceptId: to.id,
              relationType: "CO_OCCURS",
              weight: (current?.weight ?? 0) + 1,
            });
          }
        }

        if (idx > 0) {
          const previous = conceptNamesByChunk[idx - 1]
            .map((name) => conceptByNormalizedName.get(normalizeConceptName(name)))
            .filter((value): value is { id: string; name: string } => Boolean(value));

          if (previous.length > 0 && concepts.length > 0) {
            const key = relationKey(previous[0].id, concepts[0].id, "NEXT_TO");
            const current = relationMap.get(key);
            relationMap.set(key, {
              fromConceptId: previous[0].id,
              toConceptId: concepts[0].id,
              relationType: "NEXT_TO",
              weight: (current?.weight ?? 0) + 1,
            });
          }
        }
      }

      for (const relation of relationMap.values()) {
        await tx.knowledgeRelation.create({
          data: {
            ownerAccountId,
            materialId,
            fromConceptId: relation.fromConceptId,
            toConceptId: relation.toConceptId,
            relationType: relation.relationType,
            weight: relation.weight,
          },
        });
      }

      return {
        chunkCount: createdChunks.length,
        conceptCount: conceptByNormalizedName.size,
        relationCount: relationMap.size,
      };
    });

    await prisma.material.update({
      where: { id: materialId },
      data: { indexStatus: "READY" },
    });

    return {
      materialId,
      chunkCount: stats.chunkCount,
      conceptCount: stats.conceptCount,
      relationCount: stats.relationCount,
    };
  } catch (error) {
    await prisma.material
      .update({
        where: { id: materialId },
        data: { indexStatus: "ERROR" },
      })
      .catch(() => {});

    throw error;
  }
}

export async function ensureMaterialsIndexed(
  materialIds: string[],
  ownerAccountId: string
): Promise<void> {
  const materials = await prisma.material.findMany({
    where: {
      id: { in: materialIds },
      ownerAccountId,
    },
    select: {
      id: true,
      indexStatus: true,
    },
  });

  for (const material of materials) {
    if (material.indexStatus === "READY") continue;
    await indexMaterial(material.id, ownerAccountId);
  }
}

export const indexingConstants = {
  CHUNK_SIZE,
  CHUNK_OVERLAP,
  EMBEDDING_BATCH_SIZE,
  CONCEPT_BATCH_SIZE,
};
