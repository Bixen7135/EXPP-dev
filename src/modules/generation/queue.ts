import { Queue } from "bullmq";

export const GENERATION_QUEUE_NAME = "generation";

export interface GenerationJobData {
  requestId: string;
  runToken: number;
  traceId: string;
}

const GENERATION_JOB_ID_PREFIX = "gen";

const globalForGenerationQueue = globalThis as unknown as {
  generationQueue: Queue<GenerationJobData> | undefined;
};

function getQueueConnectionOptions(): { url: string } {
  return {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  };
}

export function getGenerationQueue(): Queue<GenerationJobData> {
  if (globalForGenerationQueue.generationQueue) {
    return globalForGenerationQueue.generationQueue;
  }

  const queue = new Queue<GenerationJobData>(GENERATION_QUEUE_NAME, {
    connection: getQueueConnectionOptions(),
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: "exponential",
        delay: 2_000,
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
    globalForGenerationQueue.generationQueue = queue;
  }

  return queue;
}

export async function enqueueGenerationJob(data: GenerationJobData): Promise<void> {
  const queue = getGenerationQueue();
  await queue.add("runGeneration", data, {
    jobId: buildGenerationJobId(data.requestId, data.runToken),
  });
}

export function buildGenerationJobId(requestId: string, runToken: number): string {
  return `${GENERATION_JOB_ID_PREFIX}_${requestId}_${runToken}`;
}

export async function removeGenerationJob(requestId: string, runToken: number): Promise<boolean> {
  const queue = getGenerationQueue();
  const newJobId = buildGenerationJobId(requestId, runToken);
  const legacyJobId = `${requestId}:${runToken}`;
  const job = (await queue.getJob(newJobId)) ?? (await queue.getJob(legacyJobId));
  if (!job) return false;

  try {
    await job.remove();
    return true;
  } catch {
    return false;
  }
}
