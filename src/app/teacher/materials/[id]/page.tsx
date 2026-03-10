import { resolveSession } from "@/lib/auth/session";
import { redirect, notFound } from "next/navigation";
import { getMaterial } from "@/modules/materials/service";
import Link from "next/link";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function MaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await resolveSession();
  if (!session || (session.role !== "TEACHER" && session.role !== "ADMIN")) {
    redirect("/login");
  }

  let material;
  try {
    material = await getMaterial(id, session.id);
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof ForbiddenError) {
      notFound();
    }
    throw err;
  }

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <Link
        href="/teacher/materials"
        className="text-sm text-blue-600 hover:underline mb-4 block"
      >
        Back to Materials
      </Link>

      <h1 className="text-2xl font-bold mb-1">{material.title}</h1>
      <p className="text-gray-500 text-sm mb-2">
        {material.originalFilename} | {formatBytes(material.fileSize)} | {material.mimeType}
      </p>
      <p className="text-gray-500 text-xs mb-6">
        Last updated: {new Date(material.updatedAt).toLocaleString()}
        {material.folderPath ? ` | Folder: ${material.folderPath}` : " | Folder: Root"}
      </p>

      {material.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {material.tags.map((t, i) => (
            <span key={i} className="px-2 py-0.5 bg-gray-100 rounded text-xs">
              {t.key}: {t.value}
            </span>
          ))}
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-2">Extracted Text</h2>
        {material.status === "PROCESSING" && (
          <p className="text-yellow-700 bg-yellow-50 p-3 rounded text-sm">
            Processing...
          </p>
        )}
        {material.status === "ERROR" && (
          <p className="text-red-700 bg-red-50 p-3 rounded text-sm">
            Text extraction failed.
          </p>
        )}
        {material.status === "READY" && material.extractedText && (
          <pre className="whitespace-pre-wrap text-sm bg-gray-50 border rounded p-4 max-h-[60vh] overflow-y-auto font-mono">
            {material.extractedText}
          </pre>
        )}
        {material.status === "READY" && !material.extractedText && (
          <p className="text-gray-500 text-sm">No text extracted.</p>
        )}
      </section>
    </main>
  );
}
