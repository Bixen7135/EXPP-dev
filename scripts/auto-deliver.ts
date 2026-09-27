import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type HookInput = {
  cwd?: string;
};

const dryRun = process.argv.includes("--dry-run");
const snapshotMode = process.argv.includes("--snapshot");
const input = await readHookInput();
const repository = resolveRepository(input.cwd ?? process.cwd());

if (!repository) {
  process.stdout.write("[auto-deliver] skipped: no Git repository found.\n");
  process.exit(0);
}

const currentBranch = runGit(repository, ["branch", "--show-current"]).stdout.trim();
if (currentBranch !== "main") {
  throw new Error(`[auto-deliver] delivery requires the main branch; current branch is ${currentBranch || "detached HEAD"}.`);
}

const baselinePath = path.join(repository, ".codex", "auto-deliver-baseline.json");
if (snapshotMode) {
  writeBaseline(repository, baselinePath);
  process.stdout.write("[auto-deliver] baseline captured.\n");
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  throw new Error("[auto-deliver] no SessionStart baseline found; delivery is blocked until the next session starts.");
}

const status = runGit(repository, ["status", "--porcelain=v1", "--untracked-files=all"]);
if (status.stdout.trim().length === 0) {
  process.stdout.write("[auto-deliver] clean: nothing to commit.\n");
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as { files?: Record<string, string> };
const paths = collectEligiblePaths(status.stdout).filter((filePath) => {
  return (baseline.files?.[filePath] ?? null) !== hashPath(repository, filePath);
});
if (paths.length === 0) {
  process.stdout.write("[auto-deliver] clean: no changes since the SessionStart baseline.\n");
  process.exit(0);
}

process.stdout.write(`[auto-deliver] ${dryRun ? "would stage" : "staging"}: ${paths.join(", ")}\n`);
if (dryRun) process.exit(0);

runGit(repository, ["add", "--", ...paths]);
const staged = runGit(repository, ["diff", "--cached", "--name-only"]);
if (staged.stdout.trim().length === 0) {
  throw new Error("[auto-deliver] no eligible changes were staged.");
}

runGit(repository, ["diff", "--cached", "--check"]);
runGit(repository, ["commit", "-m", process.env.CODEX_COMMIT_MESSAGE ?? "chore: deliver completed task"]);
runGit(repository, ["push", "origin", "main"]);
process.stdout.write("[auto-deliver] committed and pushed successfully.\n");

async function readHookInput(): Promise<HookInput> {
  const stdin = await new Response(Bun.stdin).text();
  if (!stdin.trim()) return {};
  try {
    return JSON.parse(stdin) as HookInput;
  } catch {
    return {};
  }
}

function writeBaseline(repository: string, destination: string): void {
  const status = runGit(repository, ["status", "--porcelain=v1", "--untracked-files=all"]);
  const files: Record<string, string> = {};
  for (const filePath of collectEligiblePaths(status.stdout)) {
    files[filePath] = hashPath(repository, filePath);
  }
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, JSON.stringify({ createdAt: new Date().toISOString(), files }, null, 2));
}

function resolveRepository(start: string): string | null {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: start,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) return null;
  const root = result.stdout.trim();
  return root && existsSync(path.join(root, ".git")) ? root : null;
}

function runGit(cwd: string, args: string[]) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    throw new Error(`[auto-deliver] git ${args[0]} failed: ${(result.stderr || "").trim()}`);
  }
  return result;
}

function collectEligiblePaths(statusText: string): string[] {
  const paths = new Set<string>();
  for (const line of statusText.split(/\r?\n/).filter(Boolean)) {
    const candidate = line.slice(3).trim();
    if (!candidate || isProtected(candidate)) continue;
    paths.add(candidate);
  }
  return [...paths];
}

function hashPath(repository: string, filePath: string): string {
  const absolutePath = path.join(repository, filePath);
  if (!existsSync(absolutePath)) return "<deleted>";
  return createHash("sha256").update(readFileSync(absolutePath)).digest("hex");
}

function isProtected(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/").toLowerCase();
  const base = path.posix.basename(normalized);
  return (
    normalized.startsWith(".env") ||
    normalized.startsWith(".codex/") ||
    normalized.startsWith(".next/") ||
    normalized.startsWith("node_modules/") ||
    normalized.startsWith("storage/") ||
    base.endsWith(".pem") ||
    base.endsWith(".key") ||
    base.endsWith(".p12") ||
    base.includes("credential") ||
    base.includes("secret") ||
    base.includes("token")
  );
}
