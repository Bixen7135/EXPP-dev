import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSession } from "@/lib/auth/session";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { getTeacherAnalytics } from "@/modules/analytics/teacher";

const AI_HELP_MODE_LABELS: Record<string, string> = {
  NO_HELP: "No Help",
  CLARIFICATION: "Clarification Only",
  GUIDED: "Guided",
  POST_ASSESSMENT: "Post-Assessment Review",
};

export default async function TeacherAnalyticsPage() {
  const session = await resolveSession();
  if (!session || !canAccessTeacherWorkspace(session)) notFound();

  const analytics = await getTeacherAnalytics(session.id);

  return (
    <main className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Distribution and engagement summary</p>
      </div>

      {/* Totals summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Distributions", value: analytics.totals.distributions },
          { label: "Recipients", value: analytics.totals.recipients },
          { label: "Submitted", value: analytics.totals.submitted },
          { label: "Results Published", value: analytics.totals.publishedResults },
          { label: "AI Help Requests", value: analytics.totals.aiHelpAllowed },
          { label: "AI Blocked", value: analytics.totals.aiHelpBlocked },
        ].map((stat) => (
          <div key={stat.label} className="border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Per-distribution breakdown */}
      {analytics.distributions.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-gray-500">
          <p>No distributions yet. <Link href="/teacher/assignments" className="text-blue-600 hover:underline">Create an assignment</Link> to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Per-Distribution Breakdown</h2>
          {analytics.distributions.map((d) => {
            const submissionRate =
              d.totalRecipients > 0
                ? Math.round((d.submitted / d.totalRecipients) * 100)
                : 0;

            return (
              <div key={d.distributionId} className="border rounded-lg p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{d.assignmentTitle}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-1">
                      <span>{d.distributionStatus === "MANDATORY" ? "Mandatory" : "Practice"}</span>
                      {d.isGraded && <span className="text-amber-600 font-medium">Graded</span>}
                      <span>AI: {AI_HELP_MODE_LABELS[d.aiHelpMode] ?? d.aiHelpMode}</span>
                      {d.deadline && <span>Due {new Date(d.deadline).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(d.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Submission progress</span>
                    <span>{d.submitted} / {d.totalRecipients} ({submissionRate}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${submissionRate}%` }}
                    />
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center text-xs">
                  {[
                    { label: "Total", value: d.totalRecipients, color: "text-gray-900" },
                    { label: "Not Started", value: d.notStarted, color: "text-gray-500" },
                    { label: "Started", value: d.started, color: "text-blue-600" },
                    { label: "Submitted", value: d.submitted, color: "text-green-600" },
                    { label: "AI Allowed", value: d.aiHelpAllowed, color: "text-gray-700" },
                    { label: "AI Blocked", value: d.aiHelpBlocked, color: "text-red-600" },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className={`font-bold text-lg ${s.color}`}>{s.value}</p>
                      <p className="text-gray-400">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <Link
                    href={`/teacher/distribution/${d.distributionId}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View distribution
                  </Link>
                  {d.submitted > 0 && (
                    <Link
                      href={`/teacher/distribution/${d.distributionId}/review`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Review submissions
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
