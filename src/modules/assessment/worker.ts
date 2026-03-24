import { Worker } from "bullmq";
import { ASSESSMENT_AI_QUEUE_NAME, type AssessmentAiJobData } from "./queue";
import { processAssessmentAiJob } from "./service";

const globalForAssessmentWorker = globalThis as unknown as {
  assessmentWorker: Worker<AssessmentAiJobData> | undefined;
};

function getWorkerConnectionOptions(): { url: string } {
  return {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  };
}

export function startAssessmentAiWorker(): Worker<AssessmentAiJobData> {
  if (globalForAssessmentWorker.assessmentWorker) {
    return globalForAssessmentWorker.assessmentWorker;
  }

  const worker = new Worker<AssessmentAiJobData>(
    ASSESSMENT_AI_QUEUE_NAME,
    async (job) => {
      await processAssessmentAiJob({
        runId: job.data.runId,
        traceId: job.data.traceId,
      });
    },
    {
      connection: getWorkerConnectionOptions(),
      concurrency: Number.parseInt(process.env.ASSESSMENT_AI_WORKER_CONCURRENCY ?? "4", 10),
      lockDuration: 120_000,
    }
  );

  worker.on("failed", (job, err) => {
    console.error("[assessment-ai-worker] job failed", {
      jobId: job?.id,
      runId: job?.data.runId,
      assessmentId: job?.data.assessmentId,
      attemptId: job?.data.attemptId,
      trigger: job?.data.trigger,
      err,
    });
  });

  worker.on("active", (job) => {
    console.info("[assessment-ai-worker] job active", {
      jobId: job.id,
      runId: job.data.runId,
      assessmentId: job.data.assessmentId,
      attemptId: job.data.attemptId,
      trigger: job.data.trigger,
    });
  });

  worker.on("completed", (job) => {
    console.info("[assessment-ai-worker] job completed", {
      jobId: job.id,
      runId: job.data.runId,
      assessmentId: job.data.assessmentId,
      attemptId: job.data.attemptId,
      trigger: job.data.trigger,
    });
  });

  if (process.env.NODE_ENV !== "production") {
    globalForAssessmentWorker.assessmentWorker = worker;
  }

  return worker;
}
