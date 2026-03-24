import { Queue } from "bullmq";
import type { AssessmentAiRunTrigger } from "./types";

export const ASSESSMENT_AI_QUEUE_NAME = "assessment-ai";

export interface AssessmentAiJobData {
  runId: string;
  assessmentId: string;
  attemptId: string;
  reviewerAccountId: string;
  trigger: AssessmentAiRunTrigger;
  traceId: string;
  idempotencyKey: string;
}

const globalForAssessmentQueue = globalThis as unknown as {
  assessmentQueue: Queue<AssessmentAiJobData> | undefined;
};

function getQueueConnectionOptions(): { url: string } {
  return {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  };
}

export function getAssessmentAiQueue(): Queue<AssessmentAiJobData> {
  if (globalForAssessmentQueue.assessmentQueue) {
    return globalForAssessmentQueue.assessmentQueue;
  }

  const queue = new Queue<AssessmentAiJobData>(ASSESSMENT_AI_QUEUE_NAME, {
    connection: getQueueConnectionOptions(),
    defaultJobOptions: {
      attempts: 3,
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
    globalForAssessmentQueue.assessmentQueue = queue;
  }

  return queue;
}

export async function enqueueAssessmentAiJob(data: AssessmentAiJobData): Promise<void> {
  const queue = getAssessmentAiQueue();
  await queue.add("analyzeAttempt", data, {
    jobId: data.runId,
  });
}
