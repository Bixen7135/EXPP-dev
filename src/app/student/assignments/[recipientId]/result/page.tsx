import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSession } from "@/lib/auth/session";
import { canAccessStudentWorkspace } from "@/lib/auth/authorization";
import { getStudentResult } from "@/modules/assessment/service";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError, ForbiddenError } from "@/lib/errors";

type Props = { params: Promise<{ recipientId: string }> };

export default async function StudentResultPage({ params }: Props) {
  const { recipientId } = await params;
  const session = await resolveSession();
  if (!session || !canAccessStudentWorkspace(session)) notFound();

  // Resolve recipientId Ã¢â€ â€™ attemptId
  const recipient = await prisma.assignmentRecipient.findUnique({
    where: { id: recipientId },
    include: { attempt: { select: { id: true } } },
  });

  if (!recipient || recipient.recipientAccountId !== session.id) notFound();
  if (!recipient.attempt) notFound();

  const attemptId = recipient.attempt.id;

  let result;
  try {
    result = await getStudentResult(attemptId, session.id);
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof ForbiddenError) {
      return (
        <main className="p-8 max-w-2xl mx-auto space-y-6">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/student/assignments" className="hover:text-gray-700">
              My Assignments
            </Link>
            <span>/</span>
            <span className="text-gray-900">Result</span>
          </nav>
          <div className="border rounded-lg p-10 text-center text-gray-500">
            <p className="font-medium mb-2">Result not yet available</p>
            <p className="text-sm">Your teacher has not published the result for this assignment yet.</p>
            <Link
              href="/student/assignments"
              className="mt-4 inline-block text-sm text-blue-600 hover:underline"
            >
              Back to assignments
            </Link>
          </div>
        </main>
      );
    }
    throw err;
  }

  const hasGrade = result.grade !== null && result.maxGrade !== null;
  const percentage =
    hasGrade ? Math.round((result.grade! / result.maxGrade!) * 100) : null;

  return (
    <main className="p-8 max-w-2xl mx-auto space-y-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/student/assignments" className="hover:text-gray-700">
          My Assignments
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Result</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold">Your Result</h1>
        <p className="text-sm text-gray-400 mt-1">
          Published {new Date(result.publishedAt).toLocaleString()}
        </p>
      </div>

      {hasGrade ? (
        <div className="border rounded-lg p-6 text-center space-y-2">
          <p className="text-5xl font-bold text-gray-900">
            {result.grade}
            <span className="text-2xl text-gray-400"> / {result.maxGrade}</span>
          </p>
          {percentage !== null && (
            <p className="text-lg text-gray-600">{percentage}%</p>
          )}
        </div>
      ) : (
        <div className="border rounded-lg p-6 text-center text-gray-500">
          <p>No grade assigned.</p>
        </div>
      )}

      {result.comment && (
        <div className="border rounded-lg p-4 space-y-1">
          <h2 className="text-sm font-semibold text-gray-700">Teacher Feedback</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{result.comment}</p>
        </div>
      )}

      <div className="flex gap-3">
        <Link
          href={`/student/assignments/${recipientId}`}
          className="px-4 py-2 border rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          View Submission
        </Link>
        <Link
          href="/student/assignments"
          className="px-4 py-2 border rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Assignments
        </Link>
      </div>
    </main>
  );
}
