import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSession } from "@/lib/auth/session";
import { listStudentAssignments } from "@/modules/distribution/service";
import { AI_HELP_MODE_LABELS } from "@/modules/ai-help/mode-definitions";

const ATTEMPT_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-100 text-gray-600",
  DRAFT: "bg-yellow-100 text-yellow-700",
  SUBMITTED: "bg-green-100 text-green-700",
};

export default async function StudentAssignmentsPage() {
  const session = await resolveSession();
  if (!session) notFound();

  const assignments = await listStudentAssignments(session.id);

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">My Assignments</h1>

      {assignments.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-gray-500">
          <p>No assignments have been distributed to you yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {assignments.map((a) => {
            const displayStatus = a.attemptStatus ?? "not_started";
            const statusLabel =
              displayStatus === "not_started"
                ? "Not started"
                : displayStatus === "DRAFT"
                ? "In progress"
                : "Submitted";

            return (
              <li key={a.recipientId} className="border rounded-lg p-4 flex items-center justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium truncate">{a.assignmentTitle}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>By {a.teacherName}</span>
                    <span>{a.distributionStatus === "MANDATORY" ? "Mandatory" : "Practice"}</span>
                    {a.isGraded && <span className="text-amber-600 font-medium">Graded</span>}
                    <span>AI: {AI_HELP_MODE_LABELS[a.aiHelpMode]}</span>
                    {a.deadline && (
                      <span>Due {new Date(a.deadline).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      ATTEMPT_STATUS_COLORS[displayStatus] ?? "bg-gray-100"
                    }`}
                  >
                    {statusLabel}
                  </span>
                  <Link
                    href={`/student/assignments/${a.recipientId}`}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                  >
                    {displayStatus === "SUBMITTED" ? "View" : displayStatus === "DRAFT" ? "Continue" : "Start"}
                  </Link>
                  {displayStatus === "SUBMITTED" && (
                    <Link
                      href={`/student/assignments/${a.recipientId}/result`}
                      className="px-3 py-1.5 border rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Result
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
