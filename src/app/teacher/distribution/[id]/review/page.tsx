import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSession } from "@/lib/auth/session";
import { listSubmissionsForDistribution } from "@/modules/assessment/service";
import { getDistribution } from "@/modules/distribution/service";
import { ForbiddenError } from "@/lib/errors";

type Props = { params: Promise<{ id: string }> };

const ASSESSMENT_STATUS_COLORS: Record<string, string> = {
  null: "bg-gray-100 text-gray-500",
  PENDING: "bg-gray-100 text-gray-500",
  AUTO_CHECKED: "bg-yellow-100 text-yellow-700",
  REVIEWED: "bg-blue-100 text-blue-700",
  PUBLISHED: "bg-green-100 text-green-700",
};

const AI_STATUS_COLORS: Record<string, string> = {
  null: "bg-gray-100 text-gray-500",
  NOT_STARTED: "bg-gray-100 text-gray-600",
  QUEUED: "bg-amber-100 text-amber-700",
  PROCESSING: "bg-indigo-100 text-indigo-700",
  READY: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
};

export default async function DistributionReviewPage({ params }: Props) {
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

  let submissions;
  try {
    submissions = await listSubmissionsForDistribution(id, session.id);
  } catch {
    notFound();
  }

  const submittedSubmissions = submissions.filter((s) => s.submittedAt);

  return (
    <main className="p-8 max-w-3xl mx-auto space-y-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/teacher/assignments" className="hover:text-gray-700">
          Assignments
        </Link>
        <span>/</span>
        <Link href={`/teacher/distribution/${id}`} className="hover:text-gray-700">
          Distribution
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Review</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold">Review Submissions</h1>
        <p className="text-sm text-gray-500 mt-1">{distribution.assignmentTitle}</p>
      </div>

      <div className="flex gap-6 text-sm text-gray-600">
        <span>
          Total recipients: <strong>{submissions.length}</strong>
        </span>
        <span>
          Submitted: <strong>{submittedSubmissions.length}</strong>
        </span>
        <span>
          Published results:{" "}
          <strong>
            {submissions.filter((s) => s.assessmentStatus === "PUBLISHED").length}
          </strong>
        </span>
      </div>

      {submittedSubmissions.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-gray-500">
          <p>No submissions yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {submittedSubmissions.map((s) => {
            const statusKey = s.assessmentStatus ?? "null";
            const colorClass =
              ASSESSMENT_STATUS_COLORS[statusKey] ?? "bg-gray-100 text-gray-500";
            const aiStatusKey = s.autoCheckStatus ?? "null";
            const aiColorClass = AI_STATUS_COLORS[aiStatusKey] ?? "bg-gray-100 text-gray-500";
            return (
              <li key={s.attemptId} className="border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-mono text-gray-700">{s.recipientAccountId}</p>
                  {s.submittedAt && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Submitted {new Date(s.submittedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
                    {s.assessmentStatus ?? "Not reviewed"}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${aiColorClass}`}>
                    AI: {s.autoCheckStatus ?? "N/A"}
                  </span>
                  {s.attemptId && (
                    <Link
                      href={`/teacher/distribution/${id}/review/${s.attemptId}`}
                      className="px-3 py-1.5 border rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      {s.assessmentStatus === "PUBLISHED" ? "View" : "Review"}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
