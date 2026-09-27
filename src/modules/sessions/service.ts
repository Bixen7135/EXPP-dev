import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors";

export interface SessionLocationDto {
  countryCode: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface SessionSummaryDto {
  id: string;
  isCurrent: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  deviceLabel: string;
  browser: string;
  os: string;
  createdAt: Date;
  lastSeenAt: Date;
  location: SessionLocationDto;
}

export type SessionDetailDto = SessionSummaryDto;

function detectBrowser(userAgent: string | null): string {
  if (!userAgent) return "Unknown browser";

  const ua = userAgent.toLowerCase();

  if (ua.includes("edg/")) return "Microsoft Edge";
  if (ua.includes("opr/") || ua.includes("opera")) return "Opera";
  if (ua.includes("firefox/")) return "Firefox";
  if (ua.includes("chrome/") && !ua.includes("edg/") && !ua.includes("opr/")) return "Chrome";
  if (ua.includes("safari/") && ua.includes("version/") && !ua.includes("chrome/")) return "Safari";

  return "Unknown browser";
}

function detectOs(userAgent: string | null): string {
  if (!userAgent) return "Unknown OS";

  const ua = userAgent.toLowerCase();

  if (ua.includes("windows nt")) return "Windows";
  if (ua.includes("android")) return "Android";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod")) return "iOS";
  if (ua.includes("mac os x") || ua.includes("macintosh")) return "macOS";
  if (ua.includes("linux")) return "Linux";

  return "Unknown OS";
}

function toSessionDto(
  row: {
    id: string;
    token: string;
    ipAddress: string | null;
    userAgent: string | null;
    countryCode: string | null;
    country: string | null;
    region: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    createdAt: Date;
    lastSeenAt: Date;
  },
  currentToken: string | null
): SessionDetailDto {
  const browser = detectBrowser(row.userAgent);
  const os = detectOs(row.userAgent);

  return {
    id: row.id,
    isCurrent: currentToken != null && row.token === currentToken,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    deviceLabel:
      browser === "Unknown browser" && os === "Unknown OS"
        ? "Unknown device"
        : `${browser} on ${os}`,
    browser,
    os,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    location: {
      countryCode: row.countryCode,
      country: row.country,
      region: row.region,
      city: row.city,
      latitude: row.latitude,
      longitude: row.longitude,
    },
  };
}

export async function listSessionsForAccount(
  accountId: string,
  currentToken: string | null
): Promise<SessionSummaryDto[]> {
  const rows = await prisma.session.findMany({
    where: {
      signedInUserContextIds: { has: accountId },
    },
    select: {
      id: true,
      token: true,
      ipAddress: true,
      userAgent: true,
      countryCode: true,
      country: true,
      region: true,
      city: true,
      latitude: true,
      longitude: true,
      createdAt: true,
      lastSeenAt: true,
    },
    orderBy: [{ lastSeenAt: "desc" }, { createdAt: "desc" }],
  });

  return rows.map((row) => toSessionDto(row, currentToken));
}

export async function getSessionDetailForAccount(opts: {
  sessionId: string;
  accountId: string;
  currentToken: string | null;
}): Promise<SessionDetailDto> {
  const row = await prisma.session.findFirst({
    where: {
      id: opts.sessionId,
      signedInUserContextIds: { has: opts.accountId },
    },
    select: {
      id: true,
      token: true,
      ipAddress: true,
      userAgent: true,
      countryCode: true,
      country: true,
      region: true,
      city: true,
      latitude: true,
      longitude: true,
      createdAt: true,
      lastSeenAt: true,
    },
  });

  if (!row) {
    throw new NotFoundError("Session not found");
  }

  return toSessionDto(row, opts.currentToken);
}
