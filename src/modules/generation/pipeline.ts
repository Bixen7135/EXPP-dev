import { prisma } from "@/lib/db/prisma";
import { buildMaterialContext } from "./context-retrieval";
import { generatePlan } from "./planner";
import { generateContent } from "./generator";
import type { GenerationConstraints } from "./types";

/**
 * Runs the two-stage generation pipeline for a given request:
 *   Stage 1: PLANNING — retrieve context, generate outline
 *   Stage 2: GENERATING — produce assignment content from outline
 *
 * Status transitions: PENDING → PLANNING → GENERATING → READY (or ERROR).
 * On success the result is stored but NOT auto-published (FR-GEN-06).
 */
export async function runGenerationPipeline(requestId: string): Promise<void> {
  const request = await prisma.generationRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) throw new Error(`GenerationRequest ${requestId} not found`);

  const constraints = request.constraints as unknown as GenerationConstraints;

  try {
    // ── Stage 1: Planning ──────────────────────────────────────────────────
    await prisma.generationRequest.update({
      where: { id: requestId },
      data: { status: "PLANNING" },
    });

    const materialContext = await buildMaterialContext(
      request.materialIds,
      request.ownerAccountId
    );
    const outline = await generatePlan(constraints, materialContext);

    await prisma.generationPlan.upsert({
      where: { requestId },
      create: { requestId, outline: outline as object },
      update: { outline: outline as object },
    });

    // ── Stage 2: Generating ────────────────────────────────────────────────
    await prisma.generationRequest.update({
      where: { id: requestId },
      data: { status: "GENERATING" },
    });

    const content = await generateContent(outline, constraints, materialContext);

    await prisma.generationResult.upsert({
      where: { requestId },
      create: {
        requestId,
        content: content as object,
        format: constraints.format,
        metadata: {
          materialIds: request.materialIds,
          generatedAt: new Date().toISOString(),
        } as object,
      },
      update: {
        content: content as object,
        format: constraints.format,
        metadata: {
          materialIds: request.materialIds,
          generatedAt: new Date().toISOString(),
        } as object,
      },
    });

    await prisma.generationRequest.update({
      where: { id: requestId },
      data: { status: "READY" },
    });
  } catch (err) {
    await prisma.generationRequest
      .update({ where: { id: requestId }, data: { status: "ERROR" } })
      .catch(() => {});
    throw err;
  }
}

