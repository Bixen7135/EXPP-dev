import {
  getAssessmentAiWorker,
  restartAssessmentAiWorker,
  startAssessmentAiWorker,
} from "./worker";

const AUTO_START_RETRY_MS = 15_000;
const AUTO_WORKER_REVISION = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const globalForAssessmentWorkerAutoStart = globalThis as unknown as {
  assessmentWorkerAutoStartState?: "IDLE" | "STARTED" | "FAILED";
  assessmentWorkerAutoStartLastAttempt?: number;
  assessmentWorkerAutoStartRevision?: string;
  assessmentWorkerAutoStartInFlight?: Promise<void>;
};

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function shouldAutoStartWorker(): boolean {
  if (process.env.NODE_ENV === "test") return false;

  if (process.env.ASSESSMENT_AUTOSTART_WORKER !== undefined) {
    return isTruthy(process.env.ASSESSMENT_AUTOSTART_WORKER);
  }

  return process.env.NODE_ENV === "development";
}

/**
 * Starts assessment worker in-process (dev default) so queued assessment jobs
 * can progress even when a separate worker process is not launched.
 */
export async function ensureAssessmentWorkerAutoStarted(): Promise<void> {
  if (!shouldAutoStartWorker()) return;

  if (globalForAssessmentWorkerAutoStart.assessmentWorkerAutoStartInFlight) {
    await globalForAssessmentWorkerAutoStart.assessmentWorkerAutoStartInFlight;
    return;
  }

  const inFlight = (async () => {
    const state =
      globalForAssessmentWorkerAutoStart.assessmentWorkerAutoStartState ?? "IDLE";
    const lastAttempt =
      globalForAssessmentWorkerAutoStart.assessmentWorkerAutoStartLastAttempt ?? 0;
    const revision = globalForAssessmentWorkerAutoStart.assessmentWorkerAutoStartRevision;
    const now = Date.now();
    const isStaleStartedRevision =
      state === "STARTED" && revision !== AUTO_WORKER_REVISION;
    const hasActiveWorker = Boolean(getAssessmentAiWorker());

    if (isStaleStartedRevision) {
      console.info("[assessment-ai] restarting stale in-process worker", {
        previousRevision: revision,
        nextRevision: AUTO_WORKER_REVISION,
      });

      try {
        await restartAssessmentAiWorker();
        globalForAssessmentWorkerAutoStart.assessmentWorkerAutoStartState = "STARTED";
        globalForAssessmentWorkerAutoStart.assessmentWorkerAutoStartRevision =
          AUTO_WORKER_REVISION;
      } catch (error) {
        globalForAssessmentWorkerAutoStart.assessmentWorkerAutoStartState = "FAILED";
        globalForAssessmentWorkerAutoStart.assessmentWorkerAutoStartRevision =
          AUTO_WORKER_REVISION;
        globalForAssessmentWorkerAutoStart.assessmentWorkerAutoStartLastAttempt = now;
        console.warn(
          "[assessment-ai] failed to restart stale in-process worker",
          error
        );
      }
      return;
    }

    if (state === "STARTED" && hasActiveWorker) {
      if (revision !== AUTO_WORKER_REVISION) {
        globalForAssessmentWorkerAutoStart.assessmentWorkerAutoStartRevision =
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

    globalForAssessmentWorkerAutoStart.assessmentWorkerAutoStartLastAttempt = now;

    try {
      startAssessmentAiWorker();
      globalForAssessmentWorkerAutoStart.assessmentWorkerAutoStartState = "STARTED";
      globalForAssessmentWorkerAutoStart.assessmentWorkerAutoStartRevision =
        AUTO_WORKER_REVISION;
      console.info("[assessment-ai] in-process worker auto-started");
    } catch (error) {
      globalForAssessmentWorkerAutoStart.assessmentWorkerAutoStartState = "FAILED";
      globalForAssessmentWorkerAutoStart.assessmentWorkerAutoStartRevision =
        AUTO_WORKER_REVISION;
      console.warn("[assessment-ai] failed to auto-start in-process worker", error);
    }
  })();

  globalForAssessmentWorkerAutoStart.assessmentWorkerAutoStartInFlight = inFlight;
  try {
    await inFlight;
  } finally {
    if (globalForAssessmentWorkerAutoStart.assessmentWorkerAutoStartInFlight === inFlight) {
      globalForAssessmentWorkerAutoStart.assessmentWorkerAutoStartInFlight = undefined;
    }
  }
}
