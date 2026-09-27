import { Worker } from "bullmq";
import {
  STUDENT_ANALYTICS_INSIGHT_QUEUE_NAME,
  type StudentAnalyticsInsightJobData,
} from "./insight-queue";
import { recomputeAndPersistInsightScope } from "./insight-service";

const globalForInsightWorker = globalThis as unknown as {
  studentAnalyticsInsightWorker: Worker<StudentAnalyticsInsightJobData> | undefined;
};

function getWorkerConnectionOptions(): { url: string } {
  return {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  };
}

export function startStudentAnalyticsInsightWorker(): Worker<StudentAnalyticsInsightJobData> {
  if (globalForInsightWorker.studentAnalyticsInsightWorker) {
    return globalForInsightWorker.studentAnalyticsInsightWorker;
  }

  const worker = new Worker<StudentAnalyticsInsightJobData>(
    STUDENT_ANALYTICS_INSIGHT_QUEUE_NAME,
    async (job) => {
      await recomputeAndPersistInsightScope({
        scope: {
          learnerAccountId: job.data.learnerAccountId,
          teacherAccountId: job.data.teacherAccountId,
          subjectKey: job.data.subjectKey,
          period: job.data.period,
        },
        traceId: job.data.traceId,
      });
    },
    {
      connection: getWorkerConnectionOptions(),
      concurrency: Number.parseInt(
        process.env.STUDENT_ANALYTICS_INSIGHT_WORKER_CONCURRENCY ?? "2",
        10
      ),
      lockDuration: 120_000,
    }
  );

  worker.on("failed", (job, err) => {
    console.error("[student-analytics-insight-worker] job failed", {
      jobId: job?.id,
      learnerAccountId: job?.data.learnerAccountId,
      teacherAccountId: job?.data.teacherAccountId,
      subjectKey: job?.data.subjectKey,
      err,
    });
  });

  if (process.env.NODE_ENV !== "production") {
    globalForInsightWorker.studentAnalyticsInsightWorker = worker;
  }

  return worker;
}

export function getStudentAnalyticsInsightWorker():
  | Worker<StudentAnalyticsInsightJobData>
  | undefined {
  return globalForInsightWorker.studentAnalyticsInsightWorker;
}

export async function stopStudentAnalyticsInsightWorker(): Promise<void> {
  const worker = globalForInsightWorker.studentAnalyticsInsightWorker;
  if (!worker) return;

  try {
    await worker.close();
  } finally {
    if (globalForInsightWorker.studentAnalyticsInsightWorker === worker) {
      globalForInsightWorker.studentAnalyticsInsightWorker = undefined;
    }
  }
}

