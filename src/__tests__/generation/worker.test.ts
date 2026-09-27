import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const constructedWorkers: Array<{
  close: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
}> = [];

vi.mock("bullmq", () => {
  class WorkerMock {
    close = vi.fn().mockResolvedValue(undefined);
    on = vi.fn();

    constructor() {
      constructedWorkers.push({
        close: this.close,
        on: this.on,
      });
    }
  }

  return {
    Worker: WorkerMock,
  };
});

vi.mock("@/modules/generation/pipeline", () => ({
  runGenerationPipeline: vi.fn().mockResolvedValue(undefined),
}));

describe("generation worker lifecycle", () => {
  beforeEach(() => {
    constructedWorkers.length = 0;
  });

  afterEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("startGenerationWorker returns singleton instance", async () => {
    const workerModule = await import("@/modules/generation/worker");

    const first = workerModule.startGenerationWorker();
    const second = workerModule.startGenerationWorker();

    expect(first).toBe(second);
    expect(workerModule.getGenerationWorker()).toBe(first);
    expect(constructedWorkers.length).toBe(1);

    await workerModule.stopGenerationWorker();
  });

  it("restartGenerationWorker closes old instance and creates a new one", async () => {
    const workerModule = await import("@/modules/generation/worker");

    const oldWorker = workerModule.startGenerationWorker();
    await workerModule.restartGenerationWorker();
    const currentWorker = workerModule.getGenerationWorker();

    expect(currentWorker).toBeDefined();
    expect(currentWorker).not.toBe(oldWorker);
    expect(constructedWorkers.length).toBe(2);
    expect(constructedWorkers[0].close).toHaveBeenCalledTimes(1);

    await workerModule.stopGenerationWorker();
  });
});

