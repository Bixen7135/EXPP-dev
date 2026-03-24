import { spawnSync } from "node:child_process";

const SCRIPT_TAG = "[dev:all]";

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    stdio: "inherit",
    shell: false,
    ...options,
  });
}

function runCapture(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe",
    shell: false,
    ...options,
  });
}

function fail(message, status = 1) {
  console.error(`${SCRIPT_TAG} ${message}`);
  process.exit(status);
}

function runOrFail(command, args, stepLabel, options = {}) {
  const result = run(command, args, options);
  if (result.error) {
    if (result.error.code === "ENOENT") {
      fail(`${stepLabel} failed: command not found: ${command}`);
    }
    fail(`${stepLabel} failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`${stepLabel} failed with exit code ${result.status}.`, result.status ?? 1);
  }
}

function buildLocalEnv() {
  const env = { ...process.env };
  const postgresPort = env.POSTGRES_PORT || "5433";
  const redisPort = env.REDIS_PORT || "6380";

  if (!env.DATABASE_URL) {
    env.DATABASE_URL = `postgresql://expp:expp_secret@localhost:${postgresPort}/expp`;
    console.log(
      `${SCRIPT_TAG} DATABASE_URL is not set; using local docker default (${env.DATABASE_URL}).`
    );
  }

  if (!env.REDIS_URL) {
    env.REDIS_URL = `redis://localhost:${redisPort}`;
    console.log(
      `${SCRIPT_TAG} REDIS_URL is not set; using local docker default (${env.REDIS_URL}).`
    );
  }

  return env;
}

function ensureDockerAvailable() {
  const version = runCapture("docker", ["--version"]);
  if (version.error) {
    if (version.error.code === "ENOENT") {
      fail("Docker CLI is not installed or not in PATH. Install Docker Desktop and retry.");
    }
    fail(`Unable to run Docker CLI: ${version.error.message}`);
  }
  if (version.status !== 0) {
    fail("Docker CLI returned an error. Reinstall or repair Docker Desktop, then retry.");
  }

  const info = runCapture("docker", ["info"], { timeout: 15000 });
  if (info.error) {
    if (info.error.code === "ETIMEDOUT") {
      fail("Docker daemon check timed out. Start Docker Desktop and wait for engine startup.");
    }
    fail(`Unable to verify Docker daemon: ${info.error.message}`);
  }

  if (info.status !== 0) {
    const output = `${info.stderr ?? ""}\n${info.stdout ?? ""}`.toLowerCase();
    if (
      output.includes("dockerdesktoplinuxengine") ||
      output.includes("cannot find the file specified") ||
      output.includes("is the docker daemon running")
    ) {
      fail(
        "Docker daemon is not running. Start Docker Desktop (engine status must be running) and retry `bun run dev:all`."
      );
    }

    fail("Docker daemon is unavailable. Start Docker Desktop and retry.");
  }
}

function main() {
  const env = buildLocalEnv();

  runOrFail("bun", ["run", "dev:all:clean"], "Cleanup step", { env });
  ensureDockerAvailable();

  runOrFail(
    "docker",
    ["compose", "up", "-d", "--wait", "db", "redis"],
    "docker compose up (db/redis)",
    { env }
  );

  runOrFail("bun", ["run", "db:generate"], "Prisma generate", { env });
  runOrFail("bun", ["run", "db:push"], "Prisma db push", { env });
  runOrFail("bun", ["run", "dev"], "Next.js dev server", { env });
}

main();
