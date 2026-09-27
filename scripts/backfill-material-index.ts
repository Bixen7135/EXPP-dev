import { prisma } from "../src/lib/db/prisma";
import { enqueueMaterialIndexJob } from "../src/modules/materials/index-queue";

async function run() {
  const materials = await prisma.material.findMany({
    where: {
      status: "READY",
      indexStatus: { not: "READY" },
    },
    select: {
      id: true,
      ownerAccountId: true,
    },
  });

  for (const material of materials) {
    await enqueueMaterialIndexJob({
      materialId: material.id,
      ownerAccountId: material.ownerAccountId,
      traceId: `backfill:${Date.now()}`,
    });
  }

  console.info("[backfill-material-index] enqueued", {
    count: materials.length,
  });
}

run()
  .catch((error) => {
    console.error("[backfill-material-index] failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
