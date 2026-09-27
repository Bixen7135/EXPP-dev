import { Queue } from "bullmq";
import type { AnalyticsPeriod } from "./insight-service";

export const STUDENT_ANALYTICS_INSIGHT_QUEUE_NAME = "student-analytics-insight";

export interface StudentAnalyticsInsightJobData {
  learnerAccountId: string;
  teacherAccountId: string | null;
  subjectKey: string | null;
  period: AnalyticsPeriod;
  traceId: string;
}

const globalForInsightQueue = globalThis as unknown as {
  studentAnalyticsInsightQueue: Queue<StudentAnalyticsInsightJobData> | undefined;
};

function getQueueConnectionOptions(): { url: string } {
  return {
    url: process.env.REDIS_URL ?? "redis://localhost:6379",
  };
}

export function getStudentAnalyticsInsightQueue(): Queue<StudentAnalyticsInsightJobData> {
  if (globalForInsightQueue.studentAnalyticsInsightQueue) {
    return globalForInsightQueue.studentAnalyticsInsightQueue;
  }

  const queue = new Queue<StudentAnalyticsInsightJobData>(
    STUDENT_ANALYTICS_INSIGHT_QUEUE_NAME,
    {
      connection: getQueueConnectionOptions(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2_000,
        },
        removeOnComplete: {
          age: 24 * 60 * 60,
          count: 1000,
        },
        removeOnFail: {
          age: 7 * 24 * 60 * 60,
          count: 1000,
        },
      },
    }
  );

  if (process.env.NODE_ENV !== "production") {
    globalForInsightQueue.studentAnalyticsInsightQueue = queue;
  }

  return queue;
}

export async function enqueueStudentAnalyticsInsightJob(
  data: StudentAnalyticsInsightJobData
): Promise<void> {
  const queue = getStudentAnalyticsInsightQueue();
  await queue.add("recomputeStudentInsight", data);
}

