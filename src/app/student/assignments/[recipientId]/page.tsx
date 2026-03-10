import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSession } from "@/lib/auth/session";
import { getOrCreateAttempt } from "@/modules/completion/service";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import StudentWorkspace from "./StudentWorkspace";

type Props = { params: Promise<{ recipientId: string }> };

export default async function StudentAssignmentPage({ params }: Props) {
  const { recipientId } = await params;
  const session = await resolveSession();
  if (!session) notFound();

  let attempt;
  try {
    attempt = await getOrCreateAttempt(recipientId, session.id);
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof ForbiddenError) notFound();
    notFound();
  }

  return (
    <main className="p-8 max-w-6xl mx-auto pb-24">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/student/assignments" className="hover:text-gray-700">
          My Assignments
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{attempt.assignmentContent.title}</span>
      </nav>

      <StudentWorkspace initialAttempt={attempt} />
    </main>
  );
}
