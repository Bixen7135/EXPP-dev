import { prisma } from "@/lib/db/prisma";
import { ForbiddenError } from "@/lib/errors";

const MAX_CHARS_PER_MATERIAL = 8000;
const MAX_TOTAL_CHARS = 32000;

/**
 * Fetches selected materials, verifies ownership, and returns concatenated
 * extracted text for use as LLM context (FR-GEN-02, FR-MAT-05).
 */
export async function buildMaterialContext(
  materialIds: string[],
  teacherId: string
): Promise<string> {
  if (materialIds.length === 0) return "";

  const materials = await prisma.material.findMany({
    where: { id: { in: materialIds } },
    select: {
      id: true,
      teacherId: true,
      title: true,
      extractedText: true,
      status: true,
    },
  });

  // Security: all selected materials must belong to the requesting teacher
  for (const mat of materials) {
    if (mat.teacherId !== teacherId) throw new ForbiddenError();
  }

  const parts: string[] = [];
  let totalChars = 0;

  for (const matId of materialIds) {
    const mat = materials.find((m) => m.id === matId);
    if (!mat || mat.status !== "READY" || !mat.extractedText) continue;

    const text = mat.extractedText.slice(0, MAX_CHARS_PER_MATERIAL);
    if (totalChars + text.length > MAX_TOTAL_CHARS) break;

    parts.push(`=== Material: ${mat.title} ===\n${text}`);
    totalChars += text.length;
  }

  return parts.join("\n\n");
}
