import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSession } from "@/lib/auth/session";
import { getGenerationRequest } from "@/modules/generation/service";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import RegenerateButton from "./RegenerateButton";
import CreateAssignmentButton from "./CreateAssignmentButton";

type Props = { params: Promise<{ id: string }> };

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  PLANNING: "bg-yellow-100 text-yellow-800",
  GENERATING: "bg-blue-100 text-blue-800",
  READY: "bg-green-100 text-green-800",
  ERROR: "bg-red-100 text-red-800",
};

export default async function GenerationResultPage({ params }: Props) {
  const { id } = await params;
  const session = await resolveSession();
  if (!session) notFound();

  let gen;
  try {
    gen = await getGenerationRequest(id, session.id);
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof ForbiddenError)
      notFound();
    throw err;
  }

  const { constraints, plan, result, status, materialIds } = gen;

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Generation Result</h1>
          <p className="text-gray-500 text-sm">Request ID: {id}</p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"}`}
        >
          {status}
        </span>
      </div>

      {/* Constraints used (FR-GEN-05) */}
      <section className="p-5 border rounded-lg">
        <h2 className="font-semibold mb-3">Constraints Used</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-gray-500">Topic</dt>
          <dd className="font-medium">{constraints.topic}</dd>
          {constraints.section && (
            <>
              <dt className="text-gray-500">Section</dt>
              <dd>{constraints.section}</dd>
            </>
          )}
          <dt className="text-gray-500">Difficulty</dt>
          <dd>{constraints.difficulty}</dd>
          <dt className="text-gray-500">Format</dt>
          <dd>{constraints.format.replace("_", " ")}</dd>
          <dt className="text-gray-500">Questions</dt>
          <dd>{constraints.questionCount}</dd>
          {constraints.educationalGoals && (
            <>
              <dt className="text-gray-500">Goals</dt>
              <dd>{constraints.educationalGoals}</dd>
            </>
          )}
        </dl>
        {materialIds.length > 0 && (
          <p className="text-xs text-gray-400 mt-3">
            {materialIds.length} material{materialIds.length !== 1 ? "s" : ""}{" "}
            used as context
          </p>
        )}
      </section>

      {/* Generation plan outline (FR-GEN-03) */}
      {plan && (
        <section className="p-5 border rounded-lg">
          <h2 className="font-semibold mb-3">Generation Plan</h2>
          <p className="font-medium mb-2">{plan.title}</p>
          {plan.rationale && (
            <p className="text-sm text-gray-500 mb-3 italic">{plan.rationale}</p>
          )}
          <ul className="space-y-2">
            {plan.sections.map((sec, i) => (
              <li key={i}>
                <p className="text-sm font-medium">{sec.title}</p>
                <ul className="ml-4 list-disc text-sm text-gray-600 space-y-0.5">
                  {sec.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Generated content */}
      {result && (
        <section className="p-5 border rounded-lg">
          <h2 className="font-semibold mb-1">{result.content.title}</h2>
          <p className="text-sm text-gray-600 mb-5 italic">
            {result.content.instructions}
          </p>
          <div className="space-y-5">
            {result.content.items.map((item) => (
              <div key={item.order} className="border-l-4 border-blue-200 pl-4">
                <p className="text-xs text-gray-400 mb-1">
                  Q{item.order} · {item.type.replace("_", " ")}
                </p>
                <p className="font-medium text-sm">{item.question}</p>
                {item.options && item.options.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {item.options.map((opt, i) => (
                      <li key={i} className="text-sm text-gray-700">
                        {opt}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Expected:{" "}
                  <span className="text-gray-700">{item.expectedAnswer}</span>
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {status === "ERROR" && !result && (
        <div className="p-5 border border-red-200 rounded-lg bg-red-50">
          <p className="text-red-700 font-medium">Generation failed.</p>
          <p className="text-red-600 text-sm mt-1">
            Check that your OPENAI_API_KEY is configured and try regenerating.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {(status === "READY" || status === "ERROR") && (
          <RegenerateButton requestId={id} />
        )}
        <Link
          href="/teacher/generate"
          className="px-4 py-2 border rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          New Generation
        </Link>
        {status === "READY" && result && (
          <CreateAssignmentButton generationResultId={result.id} />
        )}
      </div>
    </main>
  );
}
