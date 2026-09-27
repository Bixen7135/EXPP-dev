import { prisma } from "@/lib/db/prisma";
import { NotFoundError, ValidationError, ForbiddenError } from "@/lib/errors";
import { GLOBAL_DEFAULT_PERMISSIONS } from "@/modules/access/policy-engine";

export interface UserSummary {
  id: string;
  domain: "GLOBAL" | "ORGANIZATION";
  displayName: string;
  avatarUrl: string | null;
  slug: string | null;
  organizationId: string | null;
  organizationName: string | null;
  isActive: boolean;
}

export interface UserContext extends UserSummary {
  userId: string;
  permissions: string[];
}

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

async function ensureRoleDefinition(opts: {
  scope: "ORGANIZATION" | "INSTITUTION";
  organizationId?: string | null;
  institutionId?: string | null;
  key: string;
  name: string;
  permissions: string[];
}): Promise<{ id: string }> {
  const existing = await prisma.roleDefinition.findFirst({
    where: {
      scope: opts.scope,
      organizationId: opts.organizationId ?? null,
      institutionId: opts.institutionId ?? null,
      key: opts.key,
    },
    select: { id: true },
  });
  if (existing) return existing;

  return prisma.roleDefinition.create({
    data: {
      scope: opts.scope,
      source: "SYSTEM",
      organizationId: opts.organizationId ?? null,
      institutionId: opts.institutionId ?? null,
      key: opts.key,
      name: opts.name,
      permissions: opts.permissions,
      isSystem: true,
    },
    select: { id: true },
  });
}

export async function createGlobalUser(opts: {
  userId: string;
  displayName: string;
}): Promise<UserSummary> {
  const userContext = await prisma.account.create({
    data: {
      userId: opts.userId,
      domain: "GLOBAL",
      environment: "PERSONAL",
      displayName: opts.displayName,
      slug: null,
    },
    include: { organization: { select: { name: true } } },
  });
  return toSummary(userContext);
}

export async function createOrganizationUser(opts: {
  userId: string;
  displayName: string;
  organizationId?: string;
  organizationName?: string;
  organizationSlug?: string;
}): Promise<UserSummary> {
  let organizationId = opts.organizationId ?? null;

  if (!organizationId) {
    const orgName = opts.organizationName?.trim();
    if (!orgName) {
      throw new ValidationError(
        "organizationName is required when organizationId is not provided"
      );
    }

    const slug = normalizeSlug(opts.organizationSlug || orgName);
    const organization = await prisma.organization.create({
      data: {
        name: orgName,
        slug: slug || `org-${Date.now()}`,
        onboardingPolicy: {
          allowedMethods: ["INVITE", "MANUAL", "BULK"],
        },
      },
      select: { id: true },
    });
    organizationId = organization.id;
  } else {
    const exists = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundError("Organization not found");
  }

  const userContext = await prisma.$transaction(async (tx) => {
    const created = await tx.account.create({
      data: {
        userId: opts.userId,
        domain: "ORGANIZATION",
        environment: "ORGANIZATION",
        displayName: opts.displayName,
        organizationId,
        slug: normalizeSlug(opts.displayName) || `usr-${Date.now()}`,
      },
    });

    await tx.accountMembership.create({
      data: {
        accountId: created.id,
        organizationId,
        status: "ACTIVE",
      },
    });

    const ownerRole = await ensureRoleDefinition({
      scope: "ORGANIZATION",
      organizationId,
      key: "org.owner",
      name: "Organization Owner",
      permissions: [
        "workspace.admin",
        "workspace.teacher",
        "workspace.student",
        "organization.manage",
        "institution.manage",
        "materials.manage",
        "generation.manage",
        "assignments.manage",
        "distribution.manage",
        "attempts.manage",
        "assessment.review",
        "analytics.view.organization",
        "analytics.view.institution",
      ],
    });

    await tx.roleAssignment.create({
      data: {
        accountId: created.id,
        roleId: ownerRole.id,
        organizationId,
      },
    });

    return tx.account.findUniqueOrThrow({
      where: { id: created.id },
      include: { organization: { select: { name: true } } },
    });
  });

  return toSummary(userContext);
}

export async function resolveUserContext(
  userContextId: string
): Promise<UserContext> {
  const userContext = await prisma.account.findUnique({
    where: { id: userContextId },
    include: {
      organization: { select: { name: true } },
      roleAssignments: {
        include: {
          role: { select: { permissions: true } },
        },
      },
    },
  });
  if (!userContext) throw new NotFoundError("User not found");
  if (!userContext.isActive) throw new ForbiddenError("User is disabled");

  const rolePermissions = userContext.roleAssignments.flatMap((assignment) => {
    const raw = assignment.role.permissions as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((item): item is string => typeof item === "string");
  });

  const permissions = new Set<string>(rolePermissions);
  if (userContext.domain === "GLOBAL") {
    for (const permission of GLOBAL_DEFAULT_PERMISSIONS) {
      permissions.add(permission);
    }
  }

  return {
    ...toSummary(userContext),
    userId: userContext.userId,
    permissions: [...permissions],
  };
}

function toSummary(userContext: {
  id: string;
  domain: "GLOBAL" | "ORGANIZATION";
  displayName: string;
  avatarUrl: string | null;
  slug: string | null;
  organizationId: string | null;
  isActive: boolean;
  organization?: { name: string } | null;
}): UserSummary {
  return {
    id: userContext.id,
    domain: userContext.domain,
    displayName: userContext.displayName,
    avatarUrl: userContext.avatarUrl,
    slug: userContext.slug ?? null,
    organizationId: userContext.organizationId ?? null,
    organizationName: userContext.organization?.name ?? null,
    isActive: userContext.isActive,
  };
}
