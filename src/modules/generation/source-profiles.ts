import { prisma } from "@/lib/db/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { validateAndNormalizeExternalUrl } from "./external-sources";

const MAX_PROFILE_NAME = 120;
const MAX_URLS_PER_PROFILE = 10;
const MAX_URL_LENGTH = 2048;

export interface ExternalSourceProfileSummary {
  id: string;
  ownerAccountId: string;
  name: string;
  includeWhitelist: boolean;
  urls: string[];
  createdAt: Date;
  updatedAt: Date;
}

async function normalizeUrl(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!trimmed) return "";

  if (trimmed.length > MAX_URL_LENGTH) {
    throw new ValidationError(`URL too long: ${trimmed.slice(0, 80)}...`);
  }

  try {
    return await validateAndNormalizeExternalUrl(trimmed);
  } catch (error) {
    throw new ValidationError(
      error instanceof Error ? error.message : `Invalid URL: ${trimmed}`
    );
  }
}

async function normalizeUrls(urls: string[]): Promise<string[]> {
  const uniqueRawUrls = [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
  if (uniqueRawUrls.length > MAX_URLS_PER_PROFILE) {
    throw new ValidationError(`Maximum ${MAX_URLS_PER_PROFILE} URLs per profile`);
  }

  const normalized: string[] = [];
  for (const url of uniqueRawUrls) {
    const value = await normalizeUrl(url);
    if (value.length > 0) {
      normalized.push(value);
    }
  }

  return [...new Set(normalized)];
}

function normalizeName(name: string): string {
  const normalized = name.trim();
  if (!normalized) {
    throw new ValidationError("Profile name is required");
  }
  if (normalized.length > MAX_PROFILE_NAME) {
    throw new ValidationError(`Profile name must be at most ${MAX_PROFILE_NAME} characters`);
  }
  return normalized;
}

export async function listExternalSourceProfiles(
  ownerAccountId: string
): Promise<ExternalSourceProfileSummary[]> {
  const profiles = await prisma.externalSourceProfile.findMany({
    where: { ownerAccountId },
    include: { urls: true },
    orderBy: { updatedAt: "desc" },
  });

  return profiles.map((profile) => ({
    id: profile.id,
    ownerAccountId: profile.ownerAccountId,
    name: profile.name,
    includeWhitelist: profile.includeWhitelist,
    urls: profile.urls.map((entry) => entry.url),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  }));
}

export async function createExternalSourceProfile(opts: {
  ownerAccountId: string;
  name: string;
  includeWhitelist?: boolean;
  urls: string[];
}): Promise<ExternalSourceProfileSummary> {
  const name = normalizeName(opts.name);
  const urls = await normalizeUrls(opts.urls ?? []);

  const created = await prisma.externalSourceProfile.create({
    data: {
      ownerAccountId: opts.ownerAccountId,
      name,
      includeWhitelist: opts.includeWhitelist ?? true,
      urls: {
        create: urls.map((url) => ({ url })),
      },
    },
    include: { urls: true },
  });

  return {
    id: created.id,
    ownerAccountId: created.ownerAccountId,
    name: created.name,
    includeWhitelist: created.includeWhitelist,
    urls: created.urls.map((entry) => entry.url),
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

export async function updateExternalSourceProfile(opts: {
  id: string;
  ownerAccountId: string;
  name?: string;
  includeWhitelist?: boolean;
  urls?: string[];
}): Promise<ExternalSourceProfileSummary> {
  const current = await prisma.externalSourceProfile.findUnique({
    where: { id: opts.id },
    include: { urls: true },
  });

  if (!current) throw new NotFoundError("Source profile not found");
  if (current.ownerAccountId !== opts.ownerAccountId) throw new ForbiddenError();

  const name = opts.name !== undefined ? normalizeName(opts.name) : current.name;
  const includeWhitelist = opts.includeWhitelist ?? current.includeWhitelist;
  const urls = opts.urls
    ? await normalizeUrls(opts.urls)
    : current.urls.map((entry) => entry.url);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.externalSourceProfileUrl.deleteMany({
      where: { profileId: opts.id },
    });

    return tx.externalSourceProfile.update({
      where: { id: opts.id },
      data: {
        name,
        includeWhitelist,
        urls: {
          create: urls.map((url) => ({ url })),
        },
      },
      include: { urls: true },
    });
  });

  return {
    id: updated.id,
    ownerAccountId: updated.ownerAccountId,
    name: updated.name,
    includeWhitelist: updated.includeWhitelist,
    urls: updated.urls.map((entry) => entry.url),
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

export async function deleteExternalSourceProfile(
  id: string,
  ownerAccountId: string
): Promise<void> {
  const current = await prisma.externalSourceProfile.findUnique({
    where: { id },
    select: {
      id: true,
      ownerAccountId: true,
    },
  });

  if (!current) throw new NotFoundError("Source profile not found");
  if (current.ownerAccountId !== ownerAccountId) throw new ForbiddenError();

  await prisma.externalSourceProfile.delete({ where: { id } });
}

export async function getExternalSourceProfileOrThrow(
  id: string,
  ownerAccountId: string
): Promise<ExternalSourceProfileSummary> {
  const profile = await prisma.externalSourceProfile.findUnique({
    where: { id },
    include: { urls: true },
  });

  if (!profile) throw new NotFoundError("Source profile not found");
  if (profile.ownerAccountId !== ownerAccountId) throw new ForbiddenError();

  return {
    id: profile.id,
    ownerAccountId: profile.ownerAccountId,
    name: profile.name,
    includeWhitelist: profile.includeWhitelist,
    urls: profile.urls.map((entry) => entry.url),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export const externalSourceProfileConstants = {
  MAX_PROFILE_NAME,
  MAX_URLS_PER_PROFILE,
  MAX_URL_LENGTH,
};
