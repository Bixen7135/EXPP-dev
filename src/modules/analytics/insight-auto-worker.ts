import {
  getStudentAnalyticsInsightWorker,
  startStudentAnalyticsInsightWorker,
} from "./insight-worker";

const AUTO_START_RETRY_MS = 15_000;

const globalForInsightAutoStart = globalThis as unknown as {
  studentInsightAutoStartState?: "IDLE" | "STARTED" | "FAILED";
  studentInsightAutoStartLastAttempt?: number;
  studentInsightAutoStartInFlight?: Promise<void>;
};

function isTruthy(value: string | undefined): boolean {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function shouldAutoStartWorker(): boolean {
  if (process.env.NODE_ENV === "test") return false;
  if (process.env.STUDENT_ANALYTICS_INSIGHT_AUTOSTART_WORKER !== undefined) {
    return isTruthy(process.env.STUDENT_ANALYTICS_INSIGHT_AUTOSTART_WORKER);
  }
  return process.env.NODE_ENV === "development";
}

export async function ensureStudentAnalyticsInsightWorkerAutoStarted(): Promise<void> {
  if (!shouldAutoStartWorker()) return;

  if (globalForInsightAutoStart.studentInsightAutoStartInFlight) {
    await globalForInsightAutoStart.studentInsightAutoStartInFlight;
    return;
  }

  const inFlight = (async () => {
    const state = globalForInsightAutoStart.studentInsightAutoStartState ?? "IDLE";
    const lastAttempt = globalForInsightAutoStart.studentInsightAutoStartLastAttempt ?? 0;
    const now = Date.now();

    if (state === "STARTED" && getStudentAnalyticsInsightWorker()) {
      return;
    }

    if (state === "FAILED" && now - lastAttempt < AUTO_START_RETRY_MS) {
      return;
    }

    globalForInsightAutoStart.studentInsightAutoStartLastAttempt = now;
    try {
      startStudentAnalyticsInsightWorker();
      globalForInsightAutoStart.studentInsightAutoStartState = "STARTED";
      console.info("[student-analytics-insight] in-process worker auto-started");
    } catch (error) {
      globalForInsightAutoStart.studentInsightAutoStartState = "FAILED";
      console.warn(
        "[student-analytics-insight] failed to auto-start in-process worker",
        error
      );
    }
  })();

  globalForInsightAutoStart.studentInsightAutoStartInFlight = inFlight;
  try {
    await inFlight;
  } finally {
    if (globalForInsightAutoStart.studentInsightAutoStartInFlight === inFlight) {
      globalForInsightAutoStart.studentInsightAutoStartInFlight = undefined;
    }
  }
}

