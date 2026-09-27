import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { resolveUserContext } from "@/modules/users/service";

const SESSION_COOKIE = "expp_session";
const SESSION_MAX_AGE =
  Number(process.env.SESSION_MAX_AGE_SECONDS ?? 86400) * 1000;
const GEOIP_ENDPOINT = "https://ipapi.co";
const REVERSE_GEOCODE_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const REVERSE_GEOCODE_USER_AGENT =
  process.env.REVERSE_GEOCODE_USER_AGENT ?? "EXPP Session Geocoder/1.0";

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

export interface SessionRequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

interface SessionGeoMetadata {
  resolvedIpAddress: string | null;
  countryCode: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface SessionMetadataSnapshot {
  ipAddress: string | null;
  userAgent: string | null;
  countryCode: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface SessionActivityPatch {
  lastSeenAt: Date;
  ipAddress?: string | null;
  userAgent?: string | null;
  countryCode?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

type SessionReverseGeoMetadata = Pick<
  SessionGeoMetadata,
  "countryCode" | "country" | "region" | "city"
>;

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

function normalizeHeaderToken(value: string): string | null {
  const trimmed = value.trim().replace(/^"|"$/g, "");
  const normalizedMappedIpv4 = trimmed.toLowerCase().startsWith("::ffff:")
    ? trimmed.slice(7)
    : trimmed;
  if (!normalizedMappedIpv4 || normalizedMappedIpv4.toLowerCase() === "unknown") {
    return null;
  }

  if (normalizedMappedIpv4.startsWith("[") && normalizedMappedIpv4.includes("]")) {
    const closingIndex = normalizedMappedIpv4.indexOf("]");
    const bracketed = normalizedMappedIpv4.slice(1, closingIndex).trim();
    return bracketed || null;
  }

  if (normalizedMappedIpv4.includes(":")) {
    const segments = normalizedMappedIpv4.split(":");
    if (segments.length === 2 && segments[0].includes(".")) {
      return segments[0].trim() || null;
    }
  }

  return normalizedMappedIpv4;
}

function normalizeForwardedFor(value: string | null): string | null {
  if (!value) return null;
  const first = value.split(",")[0];
  return normalizeHeaderToken(first);
}

function normalizeUserAgent(value: string | null): string | null {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function parseAddressPart(
  address: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = parseString(address[key]);
    if (value) return value;
  }
  return null;
}

function isPrivateIpAddress(ip: string): boolean {
  const lowered = ip.toLowerCase();
  const normalized = lowered.startsWith("::ffff:") ? lowered.slice(7) : lowered;

  if (normalized === "localhost" || normalized === "::1") {
    return true;
  }

  if (/^\d+\.\d+\.\d+\.\d+$/.test(normalized)) {
    const [a, b] = normalized.split(".").map((item) => Number.parseInt(item, 10));
    if (a === 10 || a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }

  if (normalized.startsWith("fc") || normalized.startsWith("fd")) {
    return true;
  }
  if (normalized.startsWith("fe80")) {
    return true;
  }
  if (normalized.startsWith("2001:db8")) {
    return true;
  }

  return false;
}

function shouldLookupGeoIp(ipAddress: string): boolean {
  return !isPrivateIpAddress(ipAddress);
}

async function fetchGeoMetadataForIp(ipAddress: string): Promise<SessionGeoMetadata | null> {
  const targetUrl = shouldLookupGeoIp(ipAddress)
    ? `${GEOIP_ENDPOINT}/${encodeURIComponent(ipAddress)}/json/`
    : process.env.NODE_ENV !== "production"
      ? `${GEOIP_ENDPOINT}/json/`
      : null;

  if (!targetUrl) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as Record<string, unknown>;
    if (payload.error === true) {
      return null;
    }

    const countryCodeRaw = parseString(payload.country_code);

    return {
      resolvedIpAddress: parseString(payload.ip),
      countryCode: countryCodeRaw ? countryCodeRaw.toUpperCase() : null,
      country: parseString(payload.country_name),
      region: parseString(payload.region),
      city: parseString(payload.city),
      latitude: parseNumber(payload.latitude),
      longitude: parseNumber(payload.longitude),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number
): Promise<SessionReverseGeoMetadata | null> {
  const url = new URL(REVERSE_GEOCODE_ENDPOINT);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("addressdetails", "1");

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": REVERSE_GEOCODE_USER_AGENT,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as Record<string, unknown>;
    const address = payload.address;
    if (!address || typeof address !== "object") {
      return null;
    }

    const addressFields = address as Record<string, unknown>;
    const countryCodeRaw = parseAddressPart(addressFields, ["country_code"]);
    const city = parseAddressPart(addressFields, [
      "city",
      "town",
      "village",
      "municipality",
      "hamlet",
      "locality",
    ]);
    const region = parseAddressPart(addressFields, [
      "state",
      "region",
      "province",
      "county",
    ]);
    const country = parseAddressPart(addressFields, ["country"]);

    if (!city && !region && !country && !countryCodeRaw) {
      return null;
    }

    return {
      countryCode: countryCodeRaw ? countryCodeRaw.toUpperCase() : null,
      country,
      region,
      city,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function buildSessionActivityPatch(
  existing: SessionMetadataSnapshot | null,
  requestMeta: SessionRequestMetadata | null
): Promise<SessionActivityPatch> {
  const patch: SessionActivityPatch = {
    lastSeenAt: new Date(),
  };

  if (requestMeta?.userAgent && requestMeta.userAgent !== existing?.userAgent) {
    patch.userAgent = requestMeta.userAgent;
  }

  const incomingIpAddress = requestMeta?.ipAddress ?? null;
  const incomingIpIsPrivate =
    incomingIpAddress != null ? isPrivateIpAddress(incomingIpAddress) : false;
  const existingIpAddress = existing?.ipAddress ?? null;
  const existingIpIsPrivate =
    existingIpAddress != null ? isPrivateIpAddress(existingIpAddress) : false;
  const existingHasGeo =
    existing != null &&
    (existing.city != null ||
      existing.region != null ||
      existing.country != null ||
      existing.latitude != null ||
      existing.longitude != null);

  const shouldPreservePublicIpInDev =
    process.env.NODE_ENV !== "production" &&
    incomingIpAddress != null &&
    incomingIpIsPrivate &&
    existingIpAddress != null &&
    !existingIpIsPrivate &&
    existingHasGeo;
  if (shouldPreservePublicIpInDev) {
    return patch;
  }

  const shouldBackfillGeoInDev =
    process.env.NODE_ENV !== "production" &&
    incomingIpAddress != null &&
    existing != null &&
    existing.city == null &&
    existing.country == null &&
    existing.latitude == null &&
    existing.longitude == null;

  const shouldBackfillWithoutIncomingIpInDev =
    process.env.NODE_ENV !== "production" &&
    incomingIpAddress == null &&
    (existing == null ||
      (existing.ipAddress == null &&
        existing.city == null &&
        existing.country == null &&
        existing.latitude == null &&
        existing.longitude == null));

  if (
    incomingIpAddress &&
    (incomingIpAddress !== existing?.ipAddress || shouldBackfillGeoInDev)
  ) {
    patch.ipAddress = incomingIpAddress;

    const geoMetadata = await fetchGeoMetadataForIp(incomingIpAddress);
    const resolvedIpAddress = geoMetadata?.resolvedIpAddress ?? null;
    const shouldUseResolvedPublicIpInDev =
      process.env.NODE_ENV !== "production" &&
      incomingIpIsPrivate &&
      resolvedIpAddress != null &&
      !isPrivateIpAddress(resolvedIpAddress);

    if (shouldUseResolvedPublicIpInDev) {
      patch.ipAddress = resolvedIpAddress;
    }

    patch.countryCode = geoMetadata?.countryCode ?? null;
    patch.country = geoMetadata?.country ?? null;
    patch.region = geoMetadata?.region ?? null;
    patch.city = geoMetadata?.city ?? null;
    patch.latitude = geoMetadata?.latitude ?? null;
    patch.longitude = geoMetadata?.longitude ?? null;
  } else if (shouldBackfillWithoutIncomingIpInDev) {
    const geoMetadata = await fetchGeoMetadataForIp("127.0.0.1");
    patch.ipAddress = geoMetadata?.resolvedIpAddress ?? existing?.ipAddress ?? null;
    patch.countryCode = geoMetadata?.countryCode ?? null;
    patch.country = geoMetadata?.country ?? null;
    patch.region = geoMetadata?.region ?? null;
    patch.city = geoMetadata?.city ?? null;
    patch.latitude = geoMetadata?.latitude ?? null;
    patch.longitude = geoMetadata?.longitude ?? null;
  }

  return patch;
}

async function resolveRequestMetadataFromCurrentContext(): Promise<SessionRequestMetadata | null> {
  try {
    const requestHeaders = await headers();
    return extractSessionRequestMetadata(requestHeaders);
  } catch {
    return null;
  }
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

export function extractClientIpFromHeaders(requestHeaders: Headers): string | null {
  const candidates = [
    requestHeaders.get("x-forwarded-for"),
    requestHeaders.get("x-real-ip"),
    requestHeaders.get("cf-connecting-ip"),
    requestHeaders.get("x-client-ip"),
    requestHeaders.get("x-cluster-client-ip"),
    requestHeaders.get("fastly-client-ip"),
    requestHeaders.get("true-client-ip"),
    requestHeaders.get("x-vercel-forwarded-for"),
    requestHeaders.get("x-vercel-ip"),
  ];

  for (const candidate of candidates) {
    const normalized = normalizeForwardedFor(candidate);
    if (normalized) return normalized;
  }

  return null;
}

export function extractSessionRequestMetadata(requestHeaders: Headers): SessionRequestMetadata {
  return {
    ipAddress: extractClientIpFromHeaders(requestHeaders),
    userAgent: normalizeUserAgent(requestHeaders.get("user-agent")),
  };
}

export async function upsertSessionWithUser(
  userContextId: string,
  requestMeta: SessionRequestMetadata | null = null
): Promise<string> {
  const existingToken = await getSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE);

  if (existingToken) {
    const existing = await prisma.session.findUnique({
      where: { token: existingToken },
      select: {
        id: true,
        expiresAt: true,
        signedInUserContextIds: true,
        ipAddress: true,
        userAgent: true,
        countryCode: true,
        country: true,
        region: true,
        city: true,
        latitude: true,
        longitude: true,
      },
    });

    if (existing && existing.expiresAt >= new Date()) {
      const signedInUserContextIds = [
        userContextId,
        ...existing.signedInUserContextIds.filter((id) => id !== userContextId),
      ];

      const activityPatch = await buildSessionActivityPatch(existing, requestMeta);

      await prisma.session.update({
        where: { id: existing.id },
        data: {
          activeUserContextId: userContextId,
          signedInUserContextIds,
          expiresAt,
          ...activityPatch,
        },
      });
      return existingToken;
    }

    if (existing) {
      await prisma.session.delete({ where: { id: existing.id } });
    }
  }

  const token = generateToken();
  const activityPatch = await buildSessionActivityPatch(null, requestMeta);

  await prisma.session.create({
    data: {
      token,
      activeUserContextId: userContextId,
      signedInUserContextIds: [userContextId],
      expiresAt,
      ...activityPatch,
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
  token: string,
  options?: { requestMeta?: SessionRequestMetadata | null }
): Promise<SessionUser | null> {
  const session = await prisma.session.findUnique({
    where: { token },
    select: {
      id: true,
      expiresAt: true,
      activeUserContextId: true,
      signedInUserContextIds: true,
      ipAddress: true,
      userAgent: true,
      countryCode: true,
      country: true,
      region: true,
      city: true,
      latitude: true,
      longitude: true,
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

  const activityPatch = await buildSessionActivityPatch(
    session,
    options?.requestMeta ?? null
  );

  const updateData: Prisma.SessionUncheckedUpdateInput = {
    ...activityPatch,
  };

  if (
    activeUserContextId !== session.activeUserContextId ||
    !arraysEqual(availableIds, session.signedInUserContextIds)
  ) {
    updateData.activeUserContextId = activeUserContextId;
    updateData.signedInUserContextIds = availableIds;
  }

  await prisma.session.update({
    where: { id: session.id },
    data: updateData,
  });

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

export async function resolveSession(
  requestMeta?: SessionRequestMetadata | null
): Promise<SessionUser | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const metadata = requestMeta ?? (await resolveRequestMetadataFromCurrentContext());
  return resolveSessionByToken(token, { requestMeta: metadata });
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

export async function updateCurrentSessionPreciseLocation(opts: {
  latitude: number;
  longitude: number;
}): Promise<boolean> {
  if (!Number.isFinite(opts.latitude) || !Number.isFinite(opts.longitude)) {
    return false;
  }

  const token = await getSessionToken();
  if (!token) return false;

  const normalizedLatitude = Number(Math.max(-90, Math.min(90, opts.latitude)).toFixed(6));
  const normalizedLongitude = Number(
    Math.max(-180, Math.min(180, opts.longitude)).toFixed(6)
  );

  const reverseGeo = await reverseGeocodeCoordinates(
    normalizedLatitude,
    normalizedLongitude
  );
  const updateData: Prisma.SessionUncheckedUpdateInput = {
    latitude: normalizedLatitude,
    longitude: normalizedLongitude,
    lastSeenAt: new Date(),
    countryCode: reverseGeo?.countryCode ?? null,
    country: reverseGeo?.country ?? null,
    region: reverseGeo?.region ?? null,
    city: reverseGeo?.city ?? null,
  };

  const updated = await prisma.session.updateMany({
    where: { token },
    data: updateData,
  });

  return updated.count > 0;
}
