import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveSession } from "@/lib/auth/session";
import { listAssignments } from "@/modules/assignments/service";
import type { AssignmentStatus } from "@/modules/assignments/types";
import DeleteAssignmentButton from "./DeleteAssignmentButton";

const STATUS_COLORS: Record<AssignmentStatus, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PUBLISHABLE: "bg-green-100 text-green-800",
  ASSIGNED: "bg-blue-100 text-blue-800",
};

export default async function AssignmentsPage() {
  const session = await resolveSession();
  if (!session) notFound();

  const assignments = await listAssignments(session.id);

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Assignments</h1>
        <Link
          href="/teacher/generate"
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
        >
          New from Generation
        </Link>
      </div>

      {assignments.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-gray-500">
          <p className="mb-3">No assignments yet.</p>
          <Link href="/teacher/generate" className="text-blue-600 hover:underline text-sm">
            Generate content to get started
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {assignments.map((a) => (
            <li key={a.id} className="border rounded-lg p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium truncate">{a.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Created {new Date(a.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[a.status]}`}
                >
                  {a.status}
                </span>
                <Link
                  href={`/teacher/assignments/${a.id}/edit`}
                  className="px-3 py-1.5 border rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Edit
                </Link>
                <Link
                  href={`/teacher/assignments/${a.id}/versions`}
                  className="px-3 py-1.5 border rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  History
                </Link>
                {(a.status === "PUBLISHABLE" || a.status === "ASSIGNED") && (
                  <Link
                    href={`/teacher/assignments/${a.id}/assign`}
                    className="px-3 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
                  >
                    Assign
                  </Link>
                )}
                <DeleteAssignmentButton
                  assignmentId={a.id}
                  assignmentTitle={a.title}
                  disabled={a.status === "ASSIGNED"}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
