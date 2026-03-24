import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const lockFile = join(projectRoot, ".next", "dev", "lock");

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: "utf8", ...options });
}

function parsePidLines(text) {
  return Array.from(
    new Set(
      text
        .split(/\r?\n/)
        .map((line) => Number.parseInt(line.trim(), 10))
        .filter((pid) => Number.isInteger(pid) && pid > 0)
    )
  );
}

function listPidsWindows() {
  const script =
    "$root=(Resolve-Path '.').Path; " +
    "$pattern=[Regex]::Escape($root); " +
    "Get-CimInstance Win32_Process -Filter \"name = 'node.exe'\" | " +
    "Where-Object { $_.CommandLine -and $_.CommandLine -match $pattern -and ($_.CommandLine -match 'next\\\\dist\\\\bin\\\\next\" dev' -or $_.CommandLine -match '\\\\.next\\\\dev\\\\') } | " +
    "Select-Object -ExpandProperty ProcessId";

  const result = run("powershell", ["-NoProfile", "-Command", script]);
  if (result.status !== 0) {
    return [];
  }
  return parsePidLines(result.stdout ?? "");
}

function listPidsPosix() {
  const result = run("ps", ["-eo", "pid=,args="]);
  if (result.status !== 0) {
    return [];
  }
  const lines = (result.stdout ?? "").split(/\r?\n/);
  const pids = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const firstSpace = trimmed.indexOf(" ");
    if (firstSpace < 0) continue;
    const pid = Number.parseInt(trimmed.slice(0, firstSpace), 10);
    const cmd = trimmed.slice(firstSpace + 1);
    if (!Number.isInteger(pid) || pid <= 0) continue;
    if (!cmd.includes(projectRoot)) continue;
    if (cmd.includes("next/dist/bin/next") && cmd.includes(" dev")) {
      pids.push(pid);
      continue;
    }
    if (cmd.includes(".next/dev/")) {
      pids.push(pid);
    }
  }
  return Array.from(new Set(pids));
}

function terminatePid(pid) {
  if (process.platform === "win32") {
    run("taskkill", ["/PID", String(pid), "/T", "/F"]);
    return;
  }
  run("kill", ["-TERM", String(pid)]);
  run("kill", ["-KILL", String(pid)]);
}

const pids =
  process.platform === "win32" ? listPidsWindows() : listPidsPosix();

if (pids.length === 0) {
  console.log("[dev:all:clean] No stale Next dev processes found.");
} else {
  for (const pid of pids) {
    terminatePid(pid);
    console.log(`[dev:all:clean] Terminated process ${pid}.`);
  }
}

if (existsSync(lockFile)) {
  rmSync(lockFile, { force: true });
  console.log(`[dev:all:clean] Removed lock file: ${lockFile}`);
}
