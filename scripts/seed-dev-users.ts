const SCRIPT_TAG = "[dev:seed-users]";

for (const envFile of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // Ignore missing env files and rely on existing process env vars.
  }
}

if (process.env.NODE_ENV === "production") {
  console.error(`${SCRIPT_TAG} Refusing to seed development users in production.`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://expp:expp_secret@localhost:5433/expp";
  console.log(`${SCRIPT_TAG} DATABASE_URL is not set; using local docker default.`);
}

type SeedRole = {
  key: string;
  name: string;
  permissions: string[];
};

type SeedUser = {
  email: string;
  name: string;
  displayName: string;
  domain: "GLOBAL" | "ORGANIZATION";
  role: SeedRole;
};

type IdRow = { id: string };
type SeedDbClient = {
  roleDefinition: {
    findFirst(args: unknown): Promise<IdRow | null>;
    update(args: unknown): Promise<IdRow>;
    create(args: unknown): Promise<IdRow>;
  };
  organization: {
    findUnique(args: unknown): Promise<IdRow | null>;
    create(args: unknown): Promise<IdRow>;
  };
  accountMembership: {
    findFirst(args: unknown): Promise<IdRow | null>;
    update(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<unknown>;
  };
};

const DEFAULT_PASSWORD = process.env.DEV_SEED_PASSWORD ?? "TestPass123!";
const DEV_ORG_SLUG = process.env.DEV_SEED_ORG_SLUG ?? "dev-test-school";
const DEV_ORG_NAME = process.env.DEV_SEED_ORG_NAME ?? "Dev Test School";

const ADMIN_ROLE: SeedRole = {
  key: "dev.admin",
  name: "Dev Admin",
  permissions: ["*"],
};

const TEACHER_ROLE: SeedRole = {
  key: "dev.teacher",
  name: "Dev Teacher",
  permissions: [
    "workspace.teacher",
    "workspace.student",
    "materials.manage",
    "generation.manage",
    "assignments.manage",
    "distribution.manage",
    "attempts.manage",
    "assessment.review",
    "analytics.view.self",
    "analytics.view.organization",
    "analytics.view.institution",
  ],
};

const STUDENT_ROLE: SeedRole = {
  key: "dev.student",
  name: "Dev Student",
  permissions: ["workspace.student", "analytics.view.self"],
};

const SEED_USERS: SeedUser[] = [
  {
    email: process.env.DEV_SEED_ADMIN_EMAIL ?? "admin@example.test",
    name: "Dev Admin",
    displayName: "Dev Admin",
    domain: "GLOBAL",
    role: ADMIN_ROLE,
  },
  {
    email: process.env.DEV_SEED_TEACHER_EMAIL ?? "teacher@example.test",
    name: "Dev Teacher",
    displayName: "Dev Teacher",
    domain: "ORGANIZATION",
    role: TEACHER_ROLE,
  },
  {
    email: process.env.DEV_SEED_STUDENT_EMAIL ?? "student@example.test",
    name: "Dev Student",
    displayName: "Dev Student",
    domain: "ORGANIZATION",
    role: STUDENT_ROLE,
  },
];

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

async function ensureRoleDefinition(
  client: SeedDbClient,
  opts: {
    organizationId: string | null;
    key: string;
    name: string;
    permissions: string[];
  }
): Promise<{ id: string }> {
  const existing = await client.roleDefinition.findFirst({
    where: {
      scope: "ORGANIZATION",
      organizationId: opts.organizationId,
      institutionId: null,
      key: opts.key,
    },
    select: { id: true },
  });

  if (existing) {
    return client.roleDefinition.update({
      where: { id: existing.id },
      data: {
        name: opts.name,
        permissions: opts.permissions,
        source: "SYSTEM",
        isSystem: true,
      },
      select: { id: true },
    });
  }

  return client.roleDefinition.create({
    data: {
      scope: "ORGANIZATION",
      source: "SYSTEM",
      organizationId: opts.organizationId,
      institutionId: null,
      key: opts.key,
      name: opts.name,
      permissions: opts.permissions,
      isSystem: true,
    },
    select: { id: true },
  });
}

async function ensureOrganization(client: SeedDbClient): Promise<{ id: string }> {
  const existing = await client.organization.findUnique({
    where: { slug: DEV_ORG_SLUG },
    select: { id: true },
  });
  if (existing) return existing;

  return client.organization.create({
    data: {
      slug: DEV_ORG_SLUG,
      name: DEV_ORG_NAME,
      description: "Local-only organization for role and authorization testing.",
      onboardingPolicy: {
        allowedMethods: ["INVITE", "MANUAL", "BULK"],
        seed: "dev-users",
      },
    },
    select: { id: true },
  });
}

async function ensureMembership(
  client: SeedDbClient,
  opts: { accountId: string; organizationId: string }
): Promise<void> {
  const existing = await client.accountMembership.findFirst({
    where: {
      accountId: opts.accountId,
      organizationId: opts.organizationId,
      institutionId: null,
    },
    select: { id: true },
  });
  if (existing) {
    await client.accountMembership.update({
      where: { id: existing.id },
      data: { status: "ACTIVE" },
    });
    return;
  }

  await client.accountMembership.create({
    data: {
      accountId: opts.accountId,
      organizationId: opts.organizationId,
      status: "ACTIVE",
    },
  });
}

async function seed() {
  const [{ prisma }, { hashPassword }] = await Promise.all([
    import("../src/lib/db/prisma"),
    import("../src/lib/auth/password"),
  ]);

  const passwordHash = await hashPassword(DEFAULT_PASSWORD);

  await prisma.$transaction(async (tx) => {
    const organization = await ensureOrganization(tx);

    for (const seedUser of SEED_USERS) {
      const email = normalizeEmail(seedUser.email);
      const user = await tx.user.upsert({
        where: { email },
        update: {
          passwordHash,
          name: seedUser.name,
          isActive: true,
          emailVerifiedAt: new Date(),
        },
        create: {
          email,
          passwordHash,
          name: seedUser.name,
          isActive: true,
          emailVerifiedAt: new Date(),
        },
        select: { id: true },
      });

      const organizationId =
        seedUser.domain === "ORGANIZATION" ? organization.id : null;
      const account = await tx.account.upsert({
        where: { userId: user.id },
        update: {
          domain: seedUser.domain,
          environment:
            seedUser.domain === "ORGANIZATION" ? "ORGANIZATION" : "PERSONAL",
          displayName: seedUser.displayName,
          organizationId,
          slug:
            seedUser.domain === "ORGANIZATION"
              ? normalizeSlug(seedUser.displayName)
              : null,
          isActive: true,
        },
        create: {
          userId: user.id,
          domain: seedUser.domain,
          environment:
            seedUser.domain === "ORGANIZATION" ? "ORGANIZATION" : "PERSONAL",
          displayName: seedUser.displayName,
          organizationId,
          slug:
            seedUser.domain === "ORGANIZATION"
              ? normalizeSlug(seedUser.displayName)
              : null,
          isActive: true,
        },
        select: { id: true },
      });

      if (seedUser.domain === "ORGANIZATION" && organizationId) {
        await ensureMembership(tx, { accountId: account.id, organizationId });
      }

      await tx.roleAssignment.deleteMany({ where: { accountId: account.id } });
      const role = await ensureRoleDefinition(tx, {
        organizationId,
        ...seedUser.role,
      });
      await tx.roleAssignment.create({
        data: {
          accountId: account.id,
          roleId: role.id,
          organizationId,
          institutionId: null,
        },
      });
    }
  });

  console.log(`${SCRIPT_TAG} Seeded local role-test users:`);
  for (const user of SEED_USERS) {
    console.log(`- ${user.name}: ${normalizeEmail(user.email)} / ${DEFAULT_PASSWORD}`);
  }

  await prisma.$disconnect();
}

seed().catch((error) => {
  console.error(`${SCRIPT_TAG} Failed`, error);
  process.exit(1);
});
