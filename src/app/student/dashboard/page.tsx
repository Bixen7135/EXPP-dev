import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveSession } from "@/lib/auth/session";
import { getStudentAnalytics } from "@/modules/analytics/student";

export default async function StudentDashboardPage() {
  const user = await resolveSession();
  if (!user || user.role !== "STUDENT") {
    redirect("/login");
  }

  const analytics = await getStudentAnalytics(user.id);

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-gray-600">Welcome, {user.name}</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Assigned", value: analytics.totals.total },
          { label: "In Progress", value: analytics.totals.inProgress },
          { label: "Submitted", value: analytics.totals.submitted },
          { label: "Results Available", value: analytics.totals.resultsPublished },
        ].map((stat) => (
          <div key={stat.label} className="border rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div className="flex gap-3">
        <Link
          href="/student/assignments"
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
        >
          View Assignments
        </Link>
      </div>

      {/* Recent assignments with grades */}
      {analytics.assignments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Recent Activity</h2>
          <ul className="space-y-2">
            {analytics.assignments.slice(0, 5).map((a) => (
              <li key={a.recipientId} className="border rounded-lg p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium truncate">{a.assignmentTitle}</p>
                  <p className="text-xs text-gray-500">By {a.teacherName}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {a.resultPublished && a.grade !== null ? (
                    <span className="text-sm font-semibold text-green-700">
                      {a.grade}/{a.maxGrade} ({a.percentage}%)
                    </span>
                  ) : a.recipientStatus === "SUBMITTED" ? (
                    <span className="text-xs text-gray-500">Submitted — awaiting result</span>
                  ) : a.recipientStatus === "ACTIVE" ? (
                    <span className="text-xs text-yellow-600">In progress</span>
                  ) : (
                    <span className="text-xs text-gray-400">Not started</span>
                  )}
                  <Link
                    href={`/student/assignments/${a.recipientId}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {a.recipientStatus === "SUBMITTED" ? "View" : "Open"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {analytics.assignments.length > 5 && (
            <Link
              href="/student/assignments"
              className="mt-3 inline-block text-sm text-blue-600 hover:underline"
            >
              See all {analytics.assignments.length} assignments
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
