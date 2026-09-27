import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSession } from "@/lib/auth/session";
import { listSubmissionsForDistribution } from "@/modules/assessment/service";
import { getDistribution } from "@/modules/distribution/service";
import { ForbiddenError } from "@/lib/errors";

type Props = { params: Promise<{ id: string }> };

const ASSESSMENT_STATUS_COLORS: Record<string, string> = {
  null: "bg-slate-800/70 text-slate-400",
  PENDING: "bg-slate-800/70 text-slate-400",
  AUTO_CHECKED: "bg-[color:var(--color-blue-500)]/10 text-[color:var(--color-blue-200)]",
  REVIEWED: "bg-[color:var(--color-blue-500)]/12 text-[color:var(--color-blue-200)]",
  PUBLISHED: "bg-green-100 text-green-700",
};

const AI_STATUS_COLORS: Record<string, string> = {
  null: "bg-slate-800/70 text-slate-400",
  NOT_STARTED: "bg-slate-800/70 text-slate-400",
  QUEUED: "bg-slate-800 text-slate-300",
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
      <nav className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/dashboard/assignments" className="hover:text-slate-300">
          Assignments
        </Link>
        <span>/</span>
        <Link href={`/dashboard/distribution/${id}`} className="hover:text-slate-300">
          Distribution
        </Link>
        <span>/</span>
        <span className="text-slate-100 font-medium">Review</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold">Review Submissions</h1>
        <p className="text-sm text-slate-400 mt-1">{distribution.assignmentTitle}</p>
      </div>

      <div className="flex gap-6 text-sm text-slate-400">
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
        <div className="border rounded-lg p-10 text-center text-slate-400">
          <p>No submissions yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {submittedSubmissions.map((s) => {
            const statusKey = s.assessmentStatus ?? "null";
            const colorClass =
              ASSESSMENT_STATUS_COLORS[statusKey] ?? "bg-slate-800/70 text-slate-400";
            const aiStatusKey = s.autoCheckStatus ?? "null";
            const aiColorClass = AI_STATUS_COLORS[aiStatusKey] ?? "bg-slate-800/70 text-slate-400";
            return (
              <li key={s.attemptId} className="border rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-mono text-slate-300">{s.recipientAccountId}</p>
                  {s.submittedAt && (
                    <p className="text-xs text-slate-500 mt-0.5">
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
                      href={`/dashboard/distribution/${id}/review/${s.attemptId}`}
                      className="px-3 py-1.5 border rounded text-sm font-medium text-slate-300 hover:bg-slate-900/60"
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


