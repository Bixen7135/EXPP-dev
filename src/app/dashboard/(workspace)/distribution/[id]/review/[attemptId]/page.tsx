import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSession } from "@/lib/auth/session";
import { getOrCreateAssessment } from "@/modules/assessment/service";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/db/prisma";
import type { AssignmentContent } from "@/modules/assignments/types";
import type { AttemptAnswer } from "@/modules/completion/types";
import { ReviewForm } from "./ReviewForm";

type Props = { params: Promise<{ id: string; attemptId: string }> };

export default async function ReviewAttemptPage({ params }: Props) {
  const { id: distributionId, attemptId } = await params;
  const session = await resolveSession();
  if (!session) notFound();

  // Load attempt with content and answers
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: {
      recipient: {
        include: {
          distribution: {
            include: {
              version: { select: { content: true } },
            },
          },
        },
      },
    },
  });

  if (!attempt) notFound();
  if (attempt.recipient.distribution.id !== distributionId) notFound();

  let assessment;
  try {
    assessment = await getOrCreateAssessment(attemptId, session.id);
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) notFound();
    throw err;
  }

  const content = attempt.recipient.distribution.version.content as unknown as AssignmentContent;
  const answers = (attempt.answers as unknown as AttemptAnswer[]) ?? [];
  const answerMap = new Map(answers.map((a) => [a.itemOrder, a.text]));

  return (
    <main className="p-8 max-w-3xl mx-auto space-y-6">
      <nav className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/dashboard/assignments" className="hover:text-slate-300">
          Assignments
        </Link>
        <span>/</span>
        <Link href={`/dashboard/distribution/${distributionId}/review`} className="hover:text-slate-300">
          Review
        </Link>
        <span>/</span>
        <span className="text-slate-100 font-medium">Attempt</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold">{content.title}</h1>
        <p className="text-sm text-slate-400 mt-1">Learner user: {attempt.learnerAccountId}</p>
        {attempt.submittedAt && (
          <p className="text-sm text-slate-500">
            Submitted {new Date(attempt.submittedAt).toLocaleString()}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Answers</h2>
        {content.items.map((item) => {
          const studentAnswer = answerMap.get(item.order) ?? "";
          const isCorrect =
            item.type !== "LONG_ANSWER" &&
            studentAnswer.trim().toLowerCase() === item.expectedAnswer.trim().toLowerCase();
          return (
            <div key={item.order} className="border rounded-lg p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium">
                  Q{item.order}. {item.question}
                </p>
                <span className="text-xs text-slate-500 shrink-0">{item.type}</span>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-slate-300">
                  <span className="text-slate-400 text-xs">Student answer: </span>
                  {studentAnswer || <span className="italic text-slate-500">No answer</span>}
                </p>
                {item.type !== "LONG_ANSWER" && (
                  <p className="text-sm text-slate-400 text-xs">
                    Expected:{" "}
                    <span className="font-medium text-slate-300">{item.expectedAnswer}</span>
                    {studentAnswer && (
                      <span className={`ml-2 font-medium ${isCorrect ? "text-green-600" : "text-red-500"}`}>
                        {isCorrect ? "\u2713" : "\u2717"}
                      </span>
                    )}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t pt-6">
        <ReviewForm
          attemptId={attemptId}
          assessment={assessment}
          distributionId={distributionId}
        />
      </div>
    </main>
  );
}


