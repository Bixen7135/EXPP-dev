import { startGenerationWorker } from "../src/modules/generation/worker";

const worker = startGenerationWorker();

console.info("[generation-worker] started");

const shutdown = async () => {
  console.info("[generation-worker] shutting down");
  await worker.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
