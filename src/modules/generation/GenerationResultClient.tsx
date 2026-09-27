"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { normalizeMaxScoreByQuestionType } from "@/lib/question-scoring";
import { normalizeMarkSchemeForItem } from "@/modules/generation/mark-scheme";

interface GenerationItemSource {
  type: "INTERNAL" | "EXTERNAL";
  ref: string;
  title?: string;
  excerpt?: string;
}

interface GenerationItem {
  order: number;
  type: "SHORT_ANSWER" | "MULTIPLE_CHOICE" | "LONG_ANSWER";
  question: string;
  options?: string[];
  expectedAnswer: string;
  maxScore?: number;
  rubricCriteria?: Array<{
    id: string;
    title: string;
    description: string;
    weight: number;
    type?: "EXPECTATION" | "PENALTY";
  }>;
  sources?: GenerationItemSource[];
}

interface GenerationDetail {
  id: string;
  status: string;
  constraints: {
    topic: string;
    section?: string;
    difficulty: string;
    format: string;
    questionCount: number;
    educationalGoals?: string;
    additionalInstructions?: string;
    knowledgeMode?: "INTERNAL_ONLY" | "HYBRID_EXTERNAL";
    externalSourceProfileId?: string;
  };
  materialIds: string[];
  runToken: number;
  metadata: {
    progressPercent?: number;
    currentStage?: string;
    warnings?: string[];
    stageProgress?: Array<{
      stage: string;
      startedAt: string;
      finishedAt?: string;
      detail?: string;
    }>;
    linkExtraction?: {
      explicitUrls?: string[];
      suggestedUrls?: string[];
      usedUrls?: string[];
      materialHints?: string[];
    };
    partial?: boolean;
  } | null;
  cancelRequestedAt: string | null;
  cancelReason: string | null;
  plan: {
    title: string;
    rationale?: string;
    sections: Array<{
      title: string;
      items: string[];
    }>;
  } | null;
  result: {
    id: string;
    content: {
      title: string;
      instructions: string;
      items: GenerationItem[];
    };
    metadata: Record<string, unknown> | null;
  } | null;
}

interface Props {
  requestId: string;
  workspaceBasePath: string;
  assignmentEditBasePath: string;
}

const STATUS_COLORS: Record<string, string> = {
  QUEUED: "bg-slate-700/60 text-slate-200",
  PENDING: "bg-slate-700/60 text-slate-200",
  PLANNING: "bg-[color:var(--color-blue-500)]/10 text-[color:var(--color-blue-200)]",
  RETRIEVING: "bg-indigo-100 text-indigo-800",
  GENERATING: "bg-[color:var(--color-blue-500)]/12 text-[color:var(--color-blue-200)]",
  VALIDATING: "bg-cyan-100 text-cyan-800",
  READY: "bg-emerald-100 text-emerald-800",
  ERROR: "bg-red-100 text-red-800",
  CANCELLED: "bg-orange-100 text-orange-800",
};

const PIPELINE_STAGES = [
  "QUEUED",
  "PLANNING",
  "RETRIEVING",
  "GENERATING",
  "VALIDATING",
  "READY",
] as const;

function isActiveStatus(status: string): boolean {
  return ["QUEUED", "PENDING", "PLANNING", "RETRIEVING", "GENERATING", "VALIDATING"].includes(status);
}

export default function GenerationResultClient({
  requestId,
  workspaceBasePath,
  assignmentEditBasePath,
}: Props) {
  const [data, setData] = useState<GenerationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function fetchGeneration(): Promise<void> {
    const res = await fetch(`/api/generation/${requestId}`, {
      cache: "no-store",
    });
    const json = (await res.json()) as
      | { success: true; data: GenerationDetail }
      | { success: false; error: string };

    if (!res.ok || !json.success) {
      throw new Error(json.success ? "Failed to load generation" : json.error);
    }

    setData(json.data);
  }

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setError(null);
        await fetchGeneration();
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load generation");
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, [requestId]);

  useEffect(() => {
    if (!data || !isActiveStatus(data.status)) return;

    const timer = setInterval(() => {
      void fetchGeneration().catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to refresh generation status");
      });
    }, 3000);

    return () => clearInterval(timer);
  }, [data?.status]);

  const progressPercent = useMemo(() => {
    if (!data) return 0;
    return Math.min(100, Math.max(0, data.metadata?.progressPercent ?? 0));
  }, [data]);

  const resultTotalMaxScore = useMemo(() => {
    if (!data?.result) return 0;
    return data.result.content.items.reduce(
      (sum, item) => sum + normalizeMaxScoreByQuestionType(item.type, item.maxScore),
      0
    );
  }, [data?.result]);

  const completedStageSet = useMemo(() => {
    const set = new Set<string>();
    for (const stage of data?.metadata?.stageProgress ?? []) {
      if (stage.finishedAt) {
        set.add(stage.stage);
      }
    }

    if (data?.status === "READY") {
      set.add("READY");
    }

    return set;
  }, [data]);

  async function handleRegenerate() {
    if (!data) return;
    if (!confirm("Regenerate this assignment? The current result will be replaced.")) {
      return;
    }

    setActionError(null);
    setRegenerating(true);

    try {
      const res = await fetch(`/api/generation/${data.id}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Regeneration failed");
      }

      await fetchGeneration();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleCancel() {
    if (!data) return;

    setActionError(null);
    setCancelling(true);

    try {
      const res = await fetch(`/api/generation/${data.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Cancellation failed");
      }

      await fetchGeneration();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Cancellation failed");
    } finally {
      setCancelling(false);
    }
  }

  async function handleCreateAssignment() {
    if (!data?.result) return;

    setActionError(null);
    setCreatingAssignment(true);

    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationResultId: data.result.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to create assignment");
      }

      window.location.href = `${assignmentEditBasePath}/${json.data.id}/edit`;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create assignment");
    } finally {
      setCreatingAssignment(false);
    }
  }

  if (loading) {
    return (
      <main className="p-8 max-w-4xl mx-auto">
        <p className="text-sm text-slate-400">Loading generation result...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="p-8 max-w-4xl mx-auto">
        <p className="text-sm text-red-500">{error ?? "Generation not found"}</p>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Generation Result</h1>
          <p className="text-slate-400 text-sm">Request ID: {data.id}</p>
          <p className="text-slate-500 text-xs mt-1">Run token: {data.runToken}</p>
        </div>
        <span
          className={`px-3 py-1 rounded text-sm font-medium ${STATUS_COLORS[data.status] ?? "bg-slate-700/60 text-slate-200"}`}
        >
          {data.status}
        </span>
      </div>

      <section className="p-5 border rounded-lg space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-semibold">Generation Progress</h2>
          <span className="text-sm text-slate-300">{progressPercent}%</span>
        </div>

        <div className="h-2 rounded bg-slate-800/70 overflow-hidden">
          <div
            className="h-full bg-[color:var(--color-blue-500)] transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {data.metadata?.currentStage && (
          <p className="text-sm text-slate-400">
            Current stage: <span className="font-medium text-slate-200">{data.metadata.currentStage}</span>
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {PIPELINE_STAGES.map((stage) => {
            const done = completedStageSet.has(stage);
            const active = !done && data.metadata?.currentStage === stage;
            const stateLabel = done ? "Completed" : active ? "In progress" : "Pending";

            return (
              <div
                key={stage}
                className={`border rounded px-2 py-1 ${
                  done
                    ? "border-emerald-200 bg-emerald-50/20 text-emerald-200"
                    : active
                      ? "border-[color:var(--color-blue-500)]/35 bg-[color:var(--color-blue-500)]/10 text-[color:var(--color-blue-100)]"
                      : "border-slate-700 text-slate-500"
                }`}
              >
                <p className="font-medium">{stage}</p>
                <p>{stateLabel}</p>
              </div>
            );
          })}
        </div>

        {data.metadata?.stageProgress && data.metadata.stageProgress.length > 0 && (
          <ul className="space-y-2 text-xs text-slate-400">
            {data.metadata.stageProgress.map((stage, index) => (
              <li key={`${stage.stage}-${index}`} className="border rounded px-3 py-2">
                <p className="font-medium text-slate-200">{stage.stage}</p>
                <p>Started: {new Date(stage.startedAt).toLocaleString()}</p>
                {stage.finishedAt && <p>Finished: {new Date(stage.finishedAt).toLocaleString()}</p>}
                {stage.detail && <p>{stage.detail}</p>}
              </li>
            ))}
          </ul>
        )}

        {data.metadata?.warnings && data.metadata.warnings.length > 0 && (
          <div className="border rounded p-3 workspace-accent-surface">
            <p className="text-sm font-medium text-[color:var(--color-blue-200)] mb-2">Warnings</p>
            <ul className="list-disc ml-5 text-xs text-[color:var(--color-blue-100)] space-y-1">
              {data.metadata.warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="p-5 border rounded-lg">
        <h2 className="font-semibold mb-3">Constraints Used</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <dt className="text-slate-400">Topic</dt>
          <dd className="font-medium">{data.constraints.topic}</dd>
          {data.constraints.section && (
            <>
              <dt className="text-slate-400">Section</dt>
              <dd>{data.constraints.section}</dd>
            </>
          )}
          <dt className="text-slate-400">Difficulty</dt>
          <dd>{data.constraints.difficulty}</dd>
          <dt className="text-slate-400">Format</dt>
          <dd>{data.constraints.format.replace("_", " ")}</dd>
          <dt className="text-slate-400">Questions</dt>
          <dd>{data.constraints.questionCount}</dd>
          <dt className="text-slate-400">Knowledge Mode</dt>
          <dd>{data.constraints.knowledgeMode ?? "INTERNAL_ONLY"}</dd>
        </dl>

        {data.metadata?.linkExtraction && (
          <div className="mt-4 text-xs text-slate-400 space-y-2">
            <p>
              Link extraction: explicit {data.metadata.linkExtraction.explicitUrls?.length ?? 0},
              suggested {data.metadata.linkExtraction.suggestedUrls?.length ?? 0}, used {data.metadata.linkExtraction.usedUrls?.length ?? 0}
            </p>

            {data.metadata.linkExtraction.materialHints &&
              data.metadata.linkExtraction.materialHints.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {data.metadata.linkExtraction.materialHints.map((hint) => (
                    <span key={hint} className="px-2 py-0.5 border rounded text-slate-300">
                      {hint}
                    </span>
                  ))}
                </div>
              )}

            {[
              { label: "Explicit URLs", urls: data.metadata.linkExtraction.explicitUrls ?? [] },
              { label: "Suggested URLs", urls: data.metadata.linkExtraction.suggestedUrls ?? [] },
              { label: "Used URLs", urls: data.metadata.linkExtraction.usedUrls ?? [] },
            ].map((group) =>
              group.urls.length > 0 ? (
                <div key={group.label}>
                  <p className="text-slate-300 font-medium">{group.label}</p>
                  <ul className="mt-1 space-y-1">
                    {group.urls.map((url) => (
                      <li key={`${group.label}:${url}`} className="break-all">
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline text-[color:var(--color-blue-200)]"
                        >
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null
            )}
          </div>
        )}
      </section>

      {data.plan && (
        <section className="p-5 border rounded-lg">
          <h2 className="font-semibold mb-3">Generation Plan</h2>
          <p className="font-medium mb-2">{data.plan.title}</p>
          {data.plan.rationale && (
            <p className="text-sm text-slate-400 mb-3 italic">{data.plan.rationale}</p>
          )}
          <ul className="space-y-2">
            {data.plan.sections.map((sec, i) => (
              <li key={i}>
                <p className="text-sm font-medium">{sec.title}</p>
                <ul className="ml-4 list-disc text-sm text-slate-400 space-y-0.5">
                  {sec.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.result && (
        <section className="p-5 border rounded-lg">
          <h2 className="font-semibold mb-1">{data.result.content.title}</h2>
          <p className="text-sm text-slate-400 mb-5 italic">{data.result.content.instructions}</p>
          <p className="text-xs text-slate-400 mb-5">
            Total max score: <span className="font-medium text-slate-200">{resultTotalMaxScore}</span>
          </p>
          <div className="space-y-5">
            {data.result.content.items.map((item) => {
              const maxScore = normalizeMaxScoreByQuestionType(item.type, item.maxScore);
              const markScheme = normalizeMarkSchemeForItem({
                type: item.type,
                maxScore,
                expectedAnswer: item.expectedAnswer,
                rubricCriteria: item.rubricCriteria,
              });

              return (
                <div key={item.order} className="border-l-4 border-[color:var(--color-blue-500)]/35 pl-4">
                  <p className="text-xs text-slate-500 mb-1">
                    Q{item.order} - {item.type.replace("_", " ")} - {maxScore} pt
                  </p>
                  <p className="font-medium text-sm">{item.question}</p>
                  {item.options && item.options.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {item.options.map((opt, i) => (
                        <li key={i} className="text-sm text-slate-300">
                          {opt}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-slate-500 mt-2">
                    Expected: <span className="text-slate-300">{item.expectedAnswer}</span>
                  </p>

                  <div className="mt-3 border rounded bg-slate-900/40 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-[color:var(--color-blue-200)]">
                      Mark Scheme
                    </p>
                    <ul className="mt-2 space-y-2">
                      {markScheme.map((criterion) => (
                        <li
                          key={`${item.order}:${criterion.id}`}
                          className="text-xs text-slate-300 border rounded px-2 py-1"
                        >
                          <p className="flex items-center justify-between gap-3">
                            <span className="font-medium">{criterion.title}</span>
                            <span className="text-[color:var(--color-blue-200)]">
                              {criterion.type === "PENALTY" ? "-" : ""}
                              {criterion.weight} pt
                            </span>
                          </p>
                          <p className="mt-1 text-slate-400">{criterion.description}</p>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {item.sources && item.sources.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[11px] uppercase tracking-wide text-slate-500">Sources</p>
                      <ul className="space-y-1 mt-1">
                        {item.sources.map((source, idx) => (
                          <li key={`${source.ref}-${idx}`} className="text-xs text-slate-400 border rounded px-2 py-1">
                            <p className="font-medium text-slate-300">
                              {source.type}: {source.title ?? source.ref}
                            </p>
                            <p className="break-all">{source.ref}</p>
                            {source.excerpt && (
                              <p className="mt-1 text-slate-500">{source.excerpt}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {data.status === "ERROR" && !data.result && (
        <div className="p-5 border border-red-200 rounded-lg bg-red-50/20">
          <p className="text-red-300 font-medium">Generation failed.</p>
          <p className="text-red-200 text-sm mt-1">Check logs and try regenerating.</p>
        </div>
      )}

      {data.status === "CANCELLED" && (
        <div className="p-5 border border-orange-200 rounded-lg bg-orange-50/20">
          <p className="text-orange-200 font-medium">Generation cancelled.</p>
          <p className="text-orange-100 text-sm mt-1">
            Partial draft is preserved for review.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {(data.status === "READY" || data.status === "ERROR" || data.status === "CANCELLED") && (
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="px-4 py-2 workspace-primary-action text-white rounded text-sm font-medium disabled:opacity-50"
          >
            {regenerating ? "Regenerating..." : "Regenerate"}
          </button>
        )}

        {isActiveStatus(data.status) && (
          <button
            onClick={handleCancel}
            disabled={cancelling || Boolean(data.cancelRequestedAt)}
            className="px-4 py-2 bg-orange-600 text-white rounded text-sm font-medium disabled:opacity-50"
          >
            {cancelling ? "Cancelling..." : data.cancelRequestedAt ? "Cancel Requested" : "Cancel Generation"}
          </button>
        )}

        {data.status === "CANCELLED" && (
          <button
            type="button"
            disabled
            className="px-4 py-2 bg-orange-600 text-white rounded text-sm font-medium opacity-70"
          >
            Cancelled
          </button>
        )}

        <Link
          href={`${workspaceBasePath}/generate`}
          className="px-4 py-2 border rounded text-sm font-medium text-slate-300 hover:bg-slate-900/60"
        >
          New Generation
        </Link>

        {data.status === "READY" && data.result && (
          <button
            onClick={handleCreateAssignment}
            disabled={creatingAssignment}
            className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium disabled:opacity-50"
          >
            {creatingAssignment ? "Creating..." : "Edit & Version"}
          </button>
        )}
      </div>

      {actionError && <p className="text-red-500 text-sm">{actionError}</p>}
    </main>
  );
}
