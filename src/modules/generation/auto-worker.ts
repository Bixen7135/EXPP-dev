import { getGenerationWorker, restartGenerationWorker, startGenerationWorker } from "./worker";

const AUTO_START_RETRY_MS = 15_000;
const AUTO_WORKER_REVISION = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const globalForGenerationWorkerAutoStart = globalThis as unknown as {
  generationWorkerAutoStartState?: "IDLE" | "STARTED" | "FAILED";
  generationWorkerAutoStartLastAttempt?: number;
  generationWorkerAutoStartRevision?: string;
  generationWorkerAutoStartInFlight?: Promise<void>;
};

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function shouldAutoStartWorker(): boolean {
  if (process.env.NODE_ENV === "test") return false;

  if (process.env.GENERATION_AUTOSTART_WORKER !== undefined) {
    return isTruthy(process.env.GENERATION_AUTOSTART_WORKER);
  }

  return process.env.NODE_ENV === "development";
}

/**
 * Starts generation worker in-process (dev default) so queued requests can progress
 * even when a separate worker process is not launched.
 */
export async function ensureGenerationWorkerAutoStarted(): Promise<void> {
  if (!shouldAutoStartWorker()) return;

  if (globalForGenerationWorkerAutoStart.generationWorkerAutoStartInFlight) {
    await globalForGenerationWorkerAutoStart.generationWorkerAutoStartInFlight;
    return;
  }

  const inFlight = (async () => {
    const state =
      globalForGenerationWorkerAutoStart.generationWorkerAutoStartState ?? "IDLE";
    const lastAttempt =
      globalForGenerationWorkerAutoStart.generationWorkerAutoStartLastAttempt ?? 0;
    const revision = globalForGenerationWorkerAutoStart.generationWorkerAutoStartRevision;
    const now = Date.now();
    const isStaleStartedRevision =
      state === "STARTED" && revision !== AUTO_WORKER_REVISION;
    const hasActiveWorker = Boolean(getGenerationWorker());

    if (isStaleStartedRevision) {
      console.info("[generation] restarting stale in-process worker", {
        previousRevision: revision,
        nextRevision: AUTO_WORKER_REVISION,
      });

      try {
        await restartGenerationWorker();
        globalForGenerationWorkerAutoStart.generationWorkerAutoStartState = "STARTED";
        globalForGenerationWorkerAutoStart.generationWorkerAutoStartRevision =
          AUTO_WORKER_REVISION;
      } catch (error) {
        globalForGenerationWorkerAutoStart.generationWorkerAutoStartState = "FAILED";
        globalForGenerationWorkerAutoStart.generationWorkerAutoStartRevision =
          AUTO_WORKER_REVISION;
        globalForGenerationWorkerAutoStart.generationWorkerAutoStartLastAttempt = now;
        console.warn("[generation] failed to restart stale in-process worker", error);
      }
      return;
    }

    if (state === "STARTED" && hasActiveWorker) {
      if (revision !== AUTO_WORKER_REVISION) {
        globalForGenerationWorkerAutoStart.generationWorkerAutoStartRevision =
          AUTO_WORKER_REVISION;
      }
      return;
    }

    if (
      state === "FAILED" &&
      revision === AUTO_WORKER_REVISION &&
      now - lastAttempt < AUTO_START_RETRY_MS
    ) {
      return;
    }

    globalForGenerationWorkerAutoStart.generationWorkerAutoStartLastAttempt = now;

    try {
      startGenerationWorker();
      globalForGenerationWorkerAutoStart.generationWorkerAutoStartState = "STARTED";
      globalForGenerationWorkerAutoStart.generationWorkerAutoStartRevision =
        AUTO_WORKER_REVISION;
      console.info("[generation] in-process worker auto-started");
    } catch (error) {
      globalForGenerationWorkerAutoStart.generationWorkerAutoStartState = "FAILED";
      globalForGenerationWorkerAutoStart.generationWorkerAutoStartRevision =
        AUTO_WORKER_REVISION;
      console.warn("[generation] failed to auto-start in-process worker", error);
    }
  })();

  globalForGenerationWorkerAutoStart.generationWorkerAutoStartInFlight = inFlight;
  try {
    await inFlight;
  } finally {
    if (globalForGenerationWorkerAutoStart.generationWorkerAutoStartInFlight === inFlight) {
      globalForGenerationWorkerAutoStart.generationWorkerAutoStartInFlight = undefined;
    }
  }
}
