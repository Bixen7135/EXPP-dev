import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { resolveUserContext } from "@/modules/users/service";
import crypto from "crypto";

const SESSION_COOKIE = "expp_session";
const SESSION_MAX_AGE =
  Number(process.env.SESSION_MAX_AGE_SECONDS ?? 86400) * 1000;

export interface SessionUser {
  id: string;
  userId: string;
  email: string;
  name: string;
  domain: "GLOBAL" | "ORGANIZATION";
  displayName: string;
  avatarUrl: string | null;
  organizationId: string | null;
  organizationName: string | null;
  permissions: string[];
  availableUsers: Array<{
    id: string;
    domain: "GLOBAL" | "ORGANIZATION";
    displayName: string;
    avatarUrl: string | null;
    organizationId: string | null;
    organizationName: string | null;
  }>;
  isActive: boolean;
}

function generateToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function listSignedInUsers(
  userContextIds: string[]
): Promise<
  Array<{
    id: string;
    userId: string;
    domain: "GLOBAL" | "ORGANIZATION";
    displayName: string;
    avatarUrl: string | null;
    organizationId: string | null;
    organizationName: string | null;
    user: { id: string; email: string; name: string; isActive: boolean };
  }>
> {
  const uniqueIds = Array.from(
    new Set(
      userContextIds.filter(
        (id): id is string => typeof id === "string" && id.length > 0
      )
    )
  );
  if (uniqueIds.length === 0) return [];

  const rows = await prisma.account.findMany({
    where: {
      id: { in: uniqueIds },
      isActive: true,
      user: { isActive: true },
    },
    include: {
      user: {
        select: { id: true, email: true, name: true, isActive: true },
      },
      organization: { select: { name: true } },
    },
  });

  const byId = new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        userId: row.userId,
        domain: row.domain,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        organizationId: row.organizationId,
        organizationName: row.organization?.name ?? null,
        user: row.user,
      },
    ])
  );

  return uniqueIds
    .map((id) => byId.get(id))
    .filter(
      (
        row
      ): row is {
        id: string;
        userId: string;
        domain: "GLOBAL" | "ORGANIZATION";
        displayName: string;
        avatarUrl: string | null;
        organizationId: string | null;
        organizationName: string | null;
        user: { id: string; email: string; name: string; isActive: boolean };
      } => row != null
    );
}

export async function upsertSessionWithUser(userContextId: string): Promise<string> {
  const existingToken = await getSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE);

  if (existingToken) {
    const existing = await prisma.session.findUnique({
      where: { token: existingToken },
      select: { id: true, expiresAt: true, signedInUserContextIds: true },
    });

    if (existing && existing.expiresAt >= new Date()) {
      const signedInUserContextIds = [
        userContextId,
        ...existing.signedInUserContextIds.filter((id) => id !== userContextId),
      ];

      await prisma.session.update({
        where: { id: existing.id },
        data: {
          activeUserContextId: userContextId,
          signedInUserContextIds,
          expiresAt,
        },
      });
      return existingToken;
    }

    if (existing) {
      await prisma.session.delete({ where: { id: existing.id } });
    }
  }

  const token = generateToken();
  await prisma.session.create({
    data: {
      token,
      activeUserContextId: userContextId,
      signedInUserContextIds: [userContextId],
      expiresAt,
    },
  });
  return token;
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

export async function resolveSessionByToken(
  token: string
): Promise<SessionUser | null> {
  const session = await prisma.session.findUnique({
    where: { token },
    select: {
      id: true,
      expiresAt: true,
      activeUserContextId: true,
      signedInUserContextIds: true,
    },
  });

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    return null;
  }

  const availableUsers = await listSignedInUsers(session.signedInUserContextIds);
  if (availableUsers.length === 0) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  const availableIds = availableUsers.map((item) => item.id);
  const activeUserContextId =
    session.activeUserContextId && availableIds.includes(session.activeUserContextId)
      ? session.activeUserContextId
      : availableIds[0];

  if (
    activeUserContextId !== session.activeUserContextId ||
    !arraysEqual(availableIds, session.signedInUserContextIds)
  ) {
    await prisma.session.update({
      where: { id: session.id },
      data: {
        activeUserContextId,
        signedInUserContextIds: availableIds,
      },
    });
  }

  const userContext = await resolveUserContext(activeUserContextId);
  const activeIdentity = availableUsers.find(
    (item) => item.id === activeUserContextId
  );
  if (!activeIdentity) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return {
    id: userContext.id,
    userId: activeIdentity.user.id,
    email: activeIdentity.user.email,
    name: activeIdentity.user.name,
    domain: userContext.domain,
    displayName: userContext.displayName,
    avatarUrl: userContext.avatarUrl,
    organizationId: userContext.organizationId,
    organizationName: userContext.organizationName,
    permissions: userContext.permissions,
    availableUsers: availableUsers.map((item) => ({
      id: item.id,
      domain: item.domain,
      displayName: item.displayName,
      avatarUrl: item.avatarUrl,
      organizationId: item.organizationId,
      organizationName: item.organizationName,
    })),
    isActive: activeIdentity.user.isActive,
  };
}

export async function resolveSession(): Promise<SessionUser | null> {
  const token = await getSessionToken();
  if (!token) return null;
  return resolveSessionByToken(token);
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}

export async function deleteUserSessions(userId: string): Promise<void> {
  const userContextIds = await prisma.account.findMany({
    where: { userId },
    select: { id: true },
  });
  const ids = userContextIds.map((row) => row.id);
  if (ids.length === 0) return;

  await prisma.session.deleteMany({
    where: {
      signedInUserContextIds: { hasSome: ids },
    },
  });
}

export async function setActiveUserForCurrentSession(
  userContextId: string
): Promise<boolean> {
  const token = await getSessionToken();
  if (!token) return false;

  const updated = await prisma.session.updateMany({
    where: {
      token,
      signedInUserContextIds: { has: userContextId },
    },
    data: { activeUserContextId: userContextId },
  });

  return updated.count > 0;
}
