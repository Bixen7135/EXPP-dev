import { Worker } from "bullmq";
import { GENERATION_QUEUE_NAME, type GenerationJobData } from "./queue";
import { runGenerationPipeline } from "./pipeline";

const globalForGenerationWorker = globalThis as unknown as {
  generationWorker: Worker<GenerationJobData> | undefined;
};

function getWorkerConnectionOptions(): { url: string } {
  return {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  };
}

export function startGenerationWorker(): Worker<GenerationJobData> {
  if (globalForGenerationWorker.generationWorker) {
    return globalForGenerationWorker.generationWorker;
  }

  const worker = new Worker<GenerationJobData>(
    GENERATION_QUEUE_NAME,
    async (job) => {
      await runGenerationPipeline(job.data.requestId, job.data.runToken);
    },
    {
      connection: getWorkerConnectionOptions(),
      concurrency: Number.parseInt(process.env.GENERATION_WORKER_CONCURRENCY ?? "2", 10),
      lockDuration: 120_000,
    }
  );

  worker.on("failed", (job, err) => {
    console.error("[generation-worker] job failed", {
      jobId: job?.id,
      requestId: job?.data.requestId,
      runToken: job?.data.runToken,
      err,
    });
  });

  worker.on("active", (job) => {
    console.info("[generation-worker] job active", {
      jobId: job.id,
      requestId: job.data.requestId,
      runToken: job.data.runToken,
    });
  });

  worker.on("completed", (job) => {
    console.info("[generation-worker] job completed", {
      jobId: job.id,
      requestId: job.data.requestId,
      runToken: job.data.runToken,
    });
  });

  globalForGenerationWorker.generationWorker = worker;

  return worker;
}

export function getGenerationWorker(): Worker<GenerationJobData> | undefined {
  return globalForGenerationWorker.generationWorker;
}

export async function stopGenerationWorker(): Promise<void> {
  const worker = globalForGenerationWorker.generationWorker;
  if (!worker) return;

  try {
    await worker.close();
  } finally {
    if (globalForGenerationWorker.generationWorker === worker) {
      globalForGenerationWorker.generationWorker = undefined;
    }
  }
}

export async function restartGenerationWorker(): Promise<Worker<GenerationJobData>> {
  await stopGenerationWorker();
  return startGenerationWorker();
}
