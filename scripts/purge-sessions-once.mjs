import { spawnSync } from "node:child_process";

const SCRIPT_TAG = "[db:purge:sessions:once]";

const SQL = `
TRUNCATE TABLE "sessions";
`;

function fail(message, status = 1) {
  console.error(`${SCRIPT_TAG} ${message}`);
  process.exit(status);
}

function main() {
  console.log(`${SCRIPT_TAG} Purging all session rows. This logs out all users.`);

  const result = spawnSync("bunx", ["prisma", "db", "execute", "--stdin"], {
    input: SQL,
    stdio: ["pipe", "inherit", "inherit"],
    shell: false,
    env: process.env,
  });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      fail("`bunx` command not found. Ensure Bun is installed and available in PATH.");
    }
    fail(result.error.message);
  }

  if (result.status !== 0) {
    fail(`Failed with exit code ${result.status}.`, result.status ?? 1);
  }

  console.log(`${SCRIPT_TAG} Completed.`);
}

main();
