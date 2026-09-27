import { startStudentAnalyticsInsightWorker } from "../src/modules/analytics/insight-worker";

const worker = startStudentAnalyticsInsightWorker();

console.info("[student-analytics-insight-worker] started");

const shutdown = async () => {
  console.info("[student-analytics-insight-worker] shutting down");
  await worker.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

