import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSession } from "@/lib/auth/session";
import { getDistribution } from "@/modules/distribution/service";
import { ForbiddenError } from "@/lib/errors";
import { AI_HELP_MODE_LABELS } from "@/modules/ai-help/mode-definitions";

type Props = { params: Promise<{ id: string }> };

const RECIPIENT_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  ACTIVE: "bg-blue-100 text-blue-700",
  SUBMITTED: "bg-green-100 text-green-700",
};

export default async function DistributionDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await resolveSession();
  if (!session) notFound();

  let distribution;
  try {
    distribution = await getDistribution(id, session.id);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    notFound();
  }

  const submittedCount = distribution.recipients.filter((r) => r.status === "SUBMITTED").length;
  const activeCount = distribution.recipients.filter((r) => r.status === "ACTIVE").length;

  return (
    <main className="p-8 max-w-3xl mx-auto space-y-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/teacher/assignments" className="hover:text-gray-700">
          Assignments
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Distribution</span>
      </nav>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{distribution.assignmentTitle}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span>
            Type: <strong>{distribution.status}</strong>
          </span>
          <span>
            Graded: <strong>{distribution.isGraded ? "Yes" : "No"}</strong>
          </span>
          <span>
            AI Help: <strong>{AI_HELP_MODE_LABELS[distribution.aiHelpMode]}</strong>
          </span>
          {distribution.deadline && (
            <span>
              Deadline: <strong>{new Date(distribution.deadline).toLocaleString()}</strong>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-6 text-sm text-gray-600">
          <span>
            Total recipients: <strong>{distribution.recipients.length}</strong>
          </span>
          <span>
            Active: <strong>{activeCount}</strong>
          </span>
          <span>
            Submitted: <strong>{submittedCount}</strong>
          </span>
        </div>
        {submittedCount > 0 && (
          <Link
            href={`/teacher/distribution/${distribution.id}/review`}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
          >
            Review Submissions
          </Link>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Recipients</h2>
        {distribution.recipients.length === 0 ? (
          <p className="text-gray-500 text-sm">No recipients.</p>
        ) : (
          <ul className="space-y-2">
            {distribution.recipients.map((r) => (
              <li key={r.id} className="border rounded p-3 flex items-center justify-between">
                <span className="text-sm font-mono text-gray-700">{r.recipientDisplayName}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    RECIPIENT_STATUS_COLORS[r.status] ?? "bg-gray-100"
                  }`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
