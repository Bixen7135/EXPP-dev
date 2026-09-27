import { Queue } from "bullmq";

export const MATERIAL_INDEX_QUEUE_NAME = "material-index";

export interface MaterialIndexJobData {
  materialId: string;
  ownerAccountId: string;
  traceId: string;
}

const MATERIAL_INDEX_JOB_ID_PREFIX = "matidx";

const globalForMaterialIndexQueue = globalThis as unknown as {
  materialIndexQueue: Queue<MaterialIndexJobData> | undefined;
};

function getQueueConnectionOptions(): { url: string } {
  return {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  };
}

export function getMaterialIndexQueue(): Queue<MaterialIndexJobData> {
  if (globalForMaterialIndexQueue.materialIndexQueue) {
    return globalForMaterialIndexQueue.materialIndexQueue;
  }

  const queue = new Queue<MaterialIndexJobData>(MATERIAL_INDEX_QUEUE_NAME, {
    connection: getQueueConnectionOptions(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 1_500,
      },
      removeOnComplete: {
        age: 24 * 60 * 60,
        count: 500,
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
        count: 1_000,
      },
    },
  });

  if (process.env.NODE_ENV !== "production") {
    globalForMaterialIndexQueue.materialIndexQueue = queue;
  }

  return queue;
}

export async function enqueueMaterialIndexJob(data: MaterialIndexJobData): Promise<void> {
  const queue = getMaterialIndexQueue();
  await queue.add("indexMaterial", data, {
    jobId: `${MATERIAL_INDEX_JOB_ID_PREFIX}_${data.materialId}_${Date.now()}`,
  });
}
