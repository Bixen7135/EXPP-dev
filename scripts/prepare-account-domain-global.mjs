import { spawnSync } from "node:child_process";

const SCRIPT_TAG = "[db:prepare:account-domain]";

const SQL = `
DO $$
BEGIN
  IF to_regtype('"AccountDomain"') IS NULL THEN
    RETURN;
  END IF;

  ALTER TYPE "AccountDomain" ADD VALUE IF NOT EXISTS 'GLOBAL';

  IF to_regclass('"accounts"') IS NOT NULL THEN
    UPDATE "accounts"
    SET "domain" = 'GLOBAL'::"AccountDomain"
    WHERE "domain"::text = 'PERSONAL';
  END IF;
END $$;
`;

function fail(message, status = 1) {
  console.error(`${SCRIPT_TAG} ${message}`);
  process.exit(status);
}

function main() {
  const result = spawnSync(
    "bunx",
    ["prisma", "db", "execute", "--stdin"],
    {
      input: SQL,
      stdio: ["pipe", "inherit", "inherit"],
      shell: false,
      env: process.env,
    }
  );

  if (result.error) {
    if (result.error.code === "ENOENT") {
      fail("`bunx` command not found. Ensure Bun is installed and available in PATH.");
    }
    fail(result.error.message);
  }

  if (result.status !== 0) {
    fail(`Failed with exit code ${result.status}.`, result.status ?? 1);
  }

  console.log(`${SCRIPT_TAG} AccountDomain normalization complete.`);
}

main();
