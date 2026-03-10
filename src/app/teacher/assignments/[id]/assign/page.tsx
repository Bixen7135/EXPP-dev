import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSession } from "@/lib/auth/session";
import { getAssignment } from "@/modules/assignments/service";
import { listAssignableStudents } from "@/modules/distribution/service";
import { ForbiddenError } from "@/lib/errors";
import AssignForm from "./AssignForm";

type Props = { params: Promise<{ id: string }> };

export default async function AssignPage({ params }: Props) {
  const { id } = await params;
  const session = await resolveSession();
  if (!session) notFound();

  let assignment;
  try {
    assignment = await getAssignment(id, session.id);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    notFound();
  }

  if (assignment.status !== "PUBLISHABLE" && assignment.status !== "ASSIGNED") {
    return (
      <main className="p-8 max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Cannot Distribute</h1>
        <p className="text-gray-600">
          Only PUBLISHABLE or ASSIGNED assignments can be distributed. This assignment is{" "}
          <strong>{assignment.status}</strong>.
        </p>
        <Link href={`/teacher/assignments/${id}/edit`} className="text-blue-600 hover:underline text-sm">
          Back to editor
        </Link>
      </main>
    );
  }

  const students = await listAssignableStudents();

  return (
    <main className="p-8 max-w-2xl mx-auto space-y-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/teacher/assignments" className="hover:text-gray-700">
          Assignments
        </Link>
        <span>/</span>
        <Link href={`/teacher/assignments/${id}/edit`} className="hover:text-gray-700">
          {assignment.title}
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Assign</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold">Distribute Assignment</h1>
        <p className="text-sm text-gray-500 mt-1">
          Assign <strong>{assignment.title}</strong> to students. Once distributed, the assignment
          becomes locked.
        </p>
      </div>

      <AssignForm
        assignmentId={id}
        currentVersionId={assignment.currentVersionId}
        versions={assignment.versions}
        students={students}
      />
    </main>
  );
}
