import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/generation/worker", () => ({
  getGenerationWorker: vi.fn(),
  startGenerationWorker: vi.fn(),
  restartGenerationWorker: vi.fn(),
}));

import {
  getGenerationWorker,
  restartGenerationWorker,
  startGenerationWorker,
} from "@/modules/generation/worker";
import { ensureGenerationWorkerAutoStarted } from "@/modules/generation/auto-worker";

const AUTO_STATE_KEY = "generationWorkerAutoStartState";
const AUTO_LAST_ATTEMPT_KEY = "generationWorkerAutoStartLastAttempt";
const AUTO_REVISION_KEY = "generationWorkerAutoStartRevision";
const AUTO_IN_FLIGHT_KEY = "generationWorkerAutoStartInFlight";

describe("ensureGenerationWorkerAutoStarted", () => {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAutoStart = process.env.GENERATION_AUTOSTART_WORKER;

  beforeEach(() => {
    mutableEnv.NODE_ENV = "development";
    delete mutableEnv.GENERATION_AUTOSTART_WORKER;

    const globalState = globalThis as Record<string, unknown>;
    delete globalState[AUTO_STATE_KEY];
    delete globalState[AUTO_LAST_ATTEMPT_KEY];
    delete globalState[AUTO_REVISION_KEY];
    delete globalState[AUTO_IN_FLIGHT_KEY];

    vi.mocked(getGenerationWorker).mockReset();
    vi.mocked(startGenerationWorker).mockReset();
    vi.mocked(restartGenerationWorker).mockReset();
  });

  afterEach(() => {
    mutableEnv.NODE_ENV = originalNodeEnv;
    mutableEnv.GENERATION_AUTOSTART_WORKER = originalAutoStart;
    vi.clearAllMocks();
  });

  it("starts once and does not restart on same revision", async () => {
    vi.mocked(getGenerationWorker).mockReturnValue(undefined);
    vi.mocked(startGenerationWorker).mockReturnValue({} as never);

    await ensureGenerationWorkerAutoStarted();
    vi.mocked(getGenerationWorker).mockReturnValue({} as never);
    await ensureGenerationWorkerAutoStarted();

    expect(startGenerationWorker).toHaveBeenCalledTimes(1);
    expect(restartGenerationWorker).not.toHaveBeenCalled();
  });

  it("restarts when stale worker revision is detected", async () => {
    const globalState = globalThis as Record<string, unknown>;
    globalState[AUTO_STATE_KEY] = "STARTED";
    globalState[AUTO_REVISION_KEY] = "stale-revision";

    vi.mocked(getGenerationWorker).mockReturnValue({} as never);
    vi.mocked(restartGenerationWorker).mockResolvedValue({} as never);

    await ensureGenerationWorkerAutoStarted();

    expect(restartGenerationWorker).toHaveBeenCalledTimes(1);
    expect(startGenerationWorker).not.toHaveBeenCalled();
  });
});
