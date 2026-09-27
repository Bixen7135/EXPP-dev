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

  // Resolve recipientId ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ attemptId
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
          <nav className="flex items-center gap-2 text-sm text-slate-400">
            <Link href="/dashboard/my-assignments" className="hover:text-slate-300">
              My Assignments
            </Link>
            <span>/</span>
            <span className="text-slate-100">Result</span>
          </nav>
          <div className="border rounded-lg p-10 text-center text-slate-400">
            <p className="font-medium mb-2">Result not yet available</p>
            <p className="text-sm">Your teacher has not published the result for this assignment yet.</p>
            <Link
              href="/dashboard/my-assignments"
              className="mt-4 inline-block text-sm workspace-themed-link hover:underline"
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
      <nav className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/dashboard/my-assignments" className="hover:text-slate-300">
          My Assignments
        </Link>
        <span>/</span>
        <span className="text-slate-100 font-medium">Result</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold">Your Result</h1>
        <p className="text-sm text-slate-500 mt-1">
          Published {new Date(result.publishedAt).toLocaleString()}
        </p>
      </div>

      {hasGrade ? (
        <div className="border rounded-lg p-6 text-center space-y-2">
          <p className="text-5xl font-bold text-slate-100">
            {result.grade}
            <span className="text-2xl text-slate-500"> / {result.maxGrade}</span>
          </p>
          {percentage !== null && (
            <p className="text-lg text-slate-400">{percentage}%</p>
          )}
        </div>
      ) : (
        <div className="border rounded-lg p-6 text-center text-slate-400">
          <p>No grade assigned.</p>
        </div>
      )}

      {result.comment && (
        <div className="border rounded-lg p-4 space-y-1">
          <h2 className="text-sm font-semibold text-slate-300">Teacher Feedback</h2>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{result.comment}</p>
        </div>
      )}

      {result.aiReview && (
        <div className="border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">AI Review</h2>
          <p className="text-sm text-slate-300">{result.aiReview.gradeRationale}</p>
          {result.aiReview.reviewPriority.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-slate-300 space-y-1">
              {result.aiReview.reviewPriority.map((priority) => (
                <li key={priority}>{priority}</li>
              ))}
            </ul>
          )}
          {result.aiReview.items.length > 0 && (
            <div className="space-y-2">
              {result.aiReview.items.map((item) => (
                <div key={item.itemOrder} className="rounded border p-3 space-y-1">
                  <p className="text-xs font-medium text-slate-300">Q{item.itemOrder}</p>
                  {item.whatIsCorrect.length > 0 && (
                    <p className="text-xs text-emerald-500">
                      Correct: {item.whatIsCorrect.join("; ")}
                    </p>
                  )}
                  {item.whatIsIncorrect.length > 0 && (
                    <p className="text-xs text-red-500">
                      Incorrect: {item.whatIsIncorrect.join("; ")}
                    </p>
                  )}
                  {item.whatIsMissing.length > 0 && (
                    <p className="text-xs text-[color:var(--color-blue-200)]">
                      Missing: {item.whatIsMissing.join("; ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Link
          href={`/dashboard/my-assignments/${recipientId}`}
          className="px-4 py-2 border rounded text-sm font-medium text-slate-300 hover:bg-slate-900/60"
        >
          View Submission
        </Link>
        <Link
          href="/dashboard/my-assignments"
          className="px-4 py-2 border rounded text-sm font-medium text-slate-300 hover:bg-slate-900/60"
        >
          Back to Assignments
        </Link>
      </div>
    </main>
  );
}


