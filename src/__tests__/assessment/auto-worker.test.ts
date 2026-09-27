import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/assessment/worker", () => ({
  getAssessmentAiWorker: vi.fn(),
  startAssessmentAiWorker: vi.fn(),
  restartAssessmentAiWorker: vi.fn(),
}));

import {
  getAssessmentAiWorker,
  restartAssessmentAiWorker,
  startAssessmentAiWorker,
} from "@/modules/assessment/worker";
import { ensureAssessmentWorkerAutoStarted } from "@/modules/assessment/auto-worker";

const AUTO_STATE_KEY = "assessmentWorkerAutoStartState";
const AUTO_LAST_ATTEMPT_KEY = "assessmentWorkerAutoStartLastAttempt";
const AUTO_REVISION_KEY = "assessmentWorkerAutoStartRevision";
const AUTO_IN_FLIGHT_KEY = "assessmentWorkerAutoStartInFlight";

describe("ensureAssessmentWorkerAutoStarted", () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAutoStart = process.env.ASSESSMENT_AUTOSTART_WORKER;

  beforeEach(() => {
    mutableEnv.NODE_ENV = "development";
    delete mutableEnv.ASSESSMENT_AUTOSTART_WORKER;

    const globalState = globalThis as Record<string, unknown>;
    delete globalState[AUTO_STATE_KEY];
    delete globalState[AUTO_LAST_ATTEMPT_KEY];
    delete globalState[AUTO_REVISION_KEY];
    delete globalState[AUTO_IN_FLIGHT_KEY];

    vi.mocked(getAssessmentAiWorker).mockReset();
    vi.mocked(startAssessmentAiWorker).mockReset();
    vi.mocked(restartAssessmentAiWorker).mockReset();
  });

  afterEach(() => {
    mutableEnv.NODE_ENV = originalNodeEnv;
    mutableEnv.ASSESSMENT_AUTOSTART_WORKER = originalAutoStart;
    vi.clearAllMocks();
  });

  it("starts once and does not restart on same revision", async () => {
    vi.mocked(getAssessmentAiWorker).mockReturnValue(undefined);
    vi.mocked(startAssessmentAiWorker).mockReturnValue({} as never);

    await ensureAssessmentWorkerAutoStarted();
    vi.mocked(getAssessmentAiWorker).mockReturnValue({} as never);
    await ensureAssessmentWorkerAutoStarted();

    expect(startAssessmentAiWorker).toHaveBeenCalledTimes(1);
    expect(restartAssessmentAiWorker).not.toHaveBeenCalled();
  });

  it("restarts when stale worker revision is detected", async () => {
    const globalState = globalThis as Record<string, unknown>;
    globalState[AUTO_STATE_KEY] = "STARTED";
    globalState[AUTO_REVISION_KEY] = "stale-revision";

    vi.mocked(getAssessmentAiWorker).mockReturnValue({} as never);
    vi.mocked(restartAssessmentAiWorker).mockResolvedValue({} as never);

    await ensureAssessmentWorkerAutoStarted();

    expect(restartAssessmentAiWorker).toHaveBeenCalledTimes(1);
    expect(startAssessmentAiWorker).not.toHaveBeenCalled();
  });

  it("does not auto-start in test environment", async () => {
    mutableEnv.NODE_ENV = "test";

    await ensureAssessmentWorkerAutoStarted();

    expect(startAssessmentAiWorker).not.toHaveBeenCalled();
    expect(restartAssessmentAiWorker).not.toHaveBeenCalled();
  });
});
