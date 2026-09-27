import { startMaterialIndexWorker } from "../src/modules/materials/worker";

const worker = startMaterialIndexWorker();

console.info("[material-index-worker] started");

const shutdown = async () => {
  console.info("[material-index-worker] shutting down");
  await worker.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
