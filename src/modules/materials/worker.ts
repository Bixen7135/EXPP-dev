import { Worker } from "bullmq";
import { MATERIAL_INDEX_QUEUE_NAME, type MaterialIndexJobData } from "./index-queue";
import { indexMaterial } from "./indexing";

const globalForMaterialIndexWorker = globalThis as unknown as {
  materialIndexWorker: Worker<MaterialIndexJobData> | undefined;
};

function getWorkerConnectionOptions(): { url: string } {
  return {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  };
}

export function startMaterialIndexWorker(): Worker<MaterialIndexJobData> {
  if (globalForMaterialIndexWorker.materialIndexWorker) {
    return globalForMaterialIndexWorker.materialIndexWorker;
  }

  const worker = new Worker<MaterialIndexJobData>(
    MATERIAL_INDEX_QUEUE_NAME,
    async (job) => {
      await indexMaterial(job.data.materialId, job.data.ownerAccountId);
    },
    {
      connection: getWorkerConnectionOptions(),
      concurrency: Number.parseInt(process.env.MATERIAL_INDEX_WORKER_CONCURRENCY ?? "2", 10),
      lockDuration: 120_000,
    }
  );

  worker.on("failed", (job, err) => {
    console.error("[material-index-worker] job failed", {
      jobId: job?.id,
      materialId: job?.data.materialId,
      ownerAccountId: job?.data.ownerAccountId,
      traceId: job?.data.traceId,
      err,
    });
  });

  worker.on("completed", (job) => {
    console.info("[material-index-worker] job completed", {
      jobId: job.id,
      materialId: job.data.materialId,
      ownerAccountId: job.data.ownerAccountId,
      traceId: job.data.traceId,
    });
  });

  if (process.env.NODE_ENV !== "production") {
    globalForMaterialIndexWorker.materialIndexWorker = worker;
  }

  return worker;
}
