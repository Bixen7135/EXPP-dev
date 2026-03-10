import { prisma } from "@/lib/db/prisma";
import { validateConstraints } from "./constraints";
import { runGenerationPipeline } from "./pipeline";
import { NotFoundError, ForbiddenError } from "@/lib/errors";
import type {
  GenerationConstraints,
  GenerationContent,
  GenerationPlanOutline,
  GenerationRequestSummary,
  GenerationRequestDetail,
  GenerationStatus,
} from "./types";

export { validateConstraints };

export async function createGenerationRequest(opts: {
  teacherId: string;
  constraints: unknown;
  materialIds: string[];
}): Promise<GenerationRequestDetail> {
  const { teacherId, materialIds } = opts;
  const constraints = validateConstraints(opts.constraints);

  const request = await prisma.generationRequest.create({
    data: {
      teacherId,
      status: "PENDING",
      constraints: constraints as object,
      materialIds,
    },
  });

  // Run pipeline synchronously (Phase 3 — no job queue yet, per ADR-012)
  await runGenerationPipeline(request.id);

  return getGenerationRequest(request.id, teacherId);
}

export async function listGenerationRequests(
  teacherId: string
): Promise<GenerationRequestSummary[]> {
  const rows = await prisma.generationRequest.findMany({
    where: { teacherId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toSummary);
}

export async function getGenerationRequest(
  id: string,
  teacherId: string
): Promise<GenerationRequestDetail> {
  const request = await prisma.generationRequest.findUnique({
    where: { id },
    include: { plan: true, result: true },
  });
  if (!request) throw new NotFoundError("Generation request not found");
  if (request.teacherId !== teacherId) throw new ForbiddenError();
  return toDetail(request);
}

export async function regenerateRequest(
  id: string,
  teacherId: string,
  newConstraints?: unknown
): Promise<GenerationRequestDetail> {
  const request = await prisma.generationRequest.findUnique({ where: { id } });
  if (!request) throw new NotFoundError("Generation request not found");
  if (request.teacherId !== teacherId) throw new ForbiddenError();

  if (newConstraints !== undefined) {
    const validated = validateConstraints(newConstraints);
    await prisma.generationRequest.update({
      where: { id },
      data: { constraints: validated as object, status: "PENDING" },
    });
  } else {
    await prisma.generationRequest.update({
      where: { id },
      data: { status: "PENDING" },
    });
  }

  // Re-run pipeline preserving the same request ID (FR-GEN-04)
  await runGenerationPipeline(id);

  return getGenerationRequest(id, teacherId);
}

// ── Mapping helpers ────────────────────────────────────────────────────────

type RequestRow = {
  id: string;
  teacherId: string;
  status: string;
  constraints: unknown;
  materialIds: string[];
  createdAt: Date;
  updatedAt: Date;
};

type RequestWithRelations = RequestRow & {
  plan: { outline: unknown } | null;
  result: {
    id: string;
    content: unknown;
    format: string;
    metadata: unknown;
    createdAt: Date;
  } | null;
};

function toSummary(r: RequestRow): GenerationRequestSummary {
  return {
    id: r.id,
    teacherId: r.teacherId,
    status: r.status as GenerationStatus,
    constraints: r.constraints as unknown as GenerationConstraints,
    materialIds: r.materialIds,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function toDetail(r: RequestWithRelations): GenerationRequestDetail {
  return {
    ...toSummary(r),
    plan: r.plan ? (r.plan.outline as unknown as GenerationPlanOutline) : null,
    result: r.result
      ? {
          id: r.result.id,
          content: r.result.content as unknown as GenerationContent,
          format: r.result.format,
          metadata: r.result.metadata as unknown as Record<string, unknown> | null,
          createdAt: r.result.createdAt,
        }
      : null,
  };
}
