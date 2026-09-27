import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import type { AuditEventPayload } from "./types";

export async function auditLog(payload: AuditEventPayload): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        userId: payload.userId ?? null,
        actorAccountId: payload.actorAccountId ?? null,
        organizationId: payload.organizationId ?? null,
        institutionId: payload.institutionId ?? null,
        action: payload.action,
        entityType: payload.entityType ?? null,
        entityId: payload.entityId ?? null,
        context: (payload.context as Prisma.InputJsonValue | undefined) ?? Prisma.JsonNull,
        traceId: payload.traceId,
      },
    });
  } catch (err) {
    // Audit failures must never break the main flow, but must be surfaced
    console.error("[audit] failed to write audit event", {
      action: payload.action,
      traceId: payload.traceId,
      err,
    });
  }
}

