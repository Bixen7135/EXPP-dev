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

vi.mock("@/modules/assessment/service", () => ({
  processAssessmentAiJob: vi.fn().mockResolvedValue(undefined),
}));

describe("assessment worker lifecycle", () => {
  beforeEach(() => {
    constructedWorkers.length = 0;
  });

  afterEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("startAssessmentAiWorker returns singleton instance", async () => {
    const workerModule = await import("@/modules/assessment/worker");

    const first = workerModule.startAssessmentAiWorker();
    const second = workerModule.startAssessmentAiWorker();

    expect(first).toBe(second);
    expect(workerModule.getAssessmentAiWorker()).toBe(first);
    expect(constructedWorkers.length).toBe(1);

    await workerModule.stopAssessmentAiWorker();
  });

  it("restartAssessmentAiWorker closes old instance and creates a new one", async () => {
    const workerModule = await import("@/modules/assessment/worker");

    const oldWorker = workerModule.startAssessmentAiWorker();
    await workerModule.restartAssessmentAiWorker();
    const currentWorker = workerModule.getAssessmentAiWorker();

    expect(currentWorker).toBeDefined();
    expect(currentWorker).not.toBe(oldWorker);
    expect(constructedWorkers.length).toBe(2);
    expect(constructedWorkers[0].close).toHaveBeenCalledTimes(1);

    await workerModule.stopAssessmentAiWorker();
  });
});
