import { startAssessmentAiWorker } from "../src/modules/assessment/worker";

const worker = startAssessmentAiWorker();

console.info("[assessment-ai-worker] started");

const shutdown = async () => {
  console.info("[assessment-ai-worker] shutting down");
  await worker.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
