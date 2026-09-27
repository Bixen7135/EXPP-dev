import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

// ── Types ──────────────────────────────────────────────────────────────────

export interface UserSummary {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  accountCount: number;
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  context: unknown;
  traceId: string;
  createdAt: Date;
}

export interface AuditLogPage {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

// ── User Management ────────────────────────────────────────────────────────

export async function listUsers(): Promise<UserSummary[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      createdAt: true,
      _count: { select: { accounts: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  return users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    isActive: user.isActive,
    createdAt: user.createdAt,
    accountCount: user._count.accounts,
  }));
}

export async function updateUserStatus(
  targetUserId: string,
  requestingUserId: string,
  updates: { isActive?: boolean }
): Promise<UserSummary> {
  // Prevent self-modification
  if (targetUserId === requestingUserId) {
    throw new ValidationError("Cannot modify your own user");
  }

  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) throw new NotFoundError("User not found");

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: updates,
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      createdAt: true,
      _count: { select: { accounts: true } },
    },
  });

  return {
    id: updated.id,
    email: updated.email,
    name: updated.name,
    isActive: updated.isActive,
    createdAt: updated.createdAt,
    accountCount: updated._count.accounts,
  };
}

// ── Audit Log ──────────────────────────────────────────────────────────────

export interface AuditLogFilters {
  action?: string;
  userId?: string;
  entityType?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}

export async function getAuditLog(
  requestingRole: "ADMIN" | "TEACHER",
  requestingUserId: string,
  filters: AuditLogFilters = {}
): Promise<AuditLogPage> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};

  // Scoped access: teacher only sees their own events
  if (requestingRole === "TEACHER") {
    where.userId = requestingUserId;
  } else if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.action) where.action = filters.action;
  if (filters.entityType) where.entityType = filters.entityType;
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  const [events, total] = await prisma.$transaction([
    prisma.auditEvent.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.auditEvent.count({ where }),
  ]);

  const entries: AuditLogEntry[] = events.map((e) => ({
    id: e.id,
    userId: e.userId,
    userName: (e as { user?: { name: string } | null }).user?.name ?? null,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    context: e.context,
    traceId: e.traceId,
    createdAt: e.createdAt,
  }));

  return { entries, total, page, pageSize };
}
