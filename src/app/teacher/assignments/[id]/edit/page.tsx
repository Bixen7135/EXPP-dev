import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSession } from "@/lib/auth/session";
import { getAssignment } from "@/modules/assignments/service";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import AssignmentEditor from "./AssignmentEditor";

type Props = { params: Promise<{ id: string }> };

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  PUBLISHABLE: "bg-green-100 text-green-800",
  ASSIGNED: "bg-blue-100 text-blue-800",
};

export default async function AssignmentEditPage({ params }: Props) {
  const { id } = await params;
  const session = await resolveSession();
  if (!session) notFound();

  let assignment;
  try {
    assignment = await getAssignment(id, session.id);
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof ForbiddenError) notFound();
    throw err;
  }

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/teacher/assignments" className="text-sm text-gray-500 hover:underline">
              Assignments
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-sm text-gray-700 truncate max-w-xs">{assignment.title}</span>
          </div>
          <h1 className="text-2xl font-bold">Edit Assignment</h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[assignment.status] ?? "bg-gray-100 text-gray-700"}`}
          >
            {assignment.status}
          </span>
          <Link
            href={`/teacher/assignments/${id}/versions`}
            className="px-3 py-1.5 border rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Version History ({assignment.versions.length})
          </Link>
        </div>
      </div>

      <AssignmentEditor assignment={assignment} />
    </main>
  );
}
