"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEditorStore } from "@/modules/assignments/editor-store";
import type { AssignmentDetail } from "@/modules/assignments/types";

interface Props {
  assignment: AssignmentDetail;
}

interface TaskBankTag {
  key: string;
  value: string;
}

interface TaskBankItem {
  id: string;
  title: string;
  content: {
    type: AssignmentDetail["content"]["items"][number]["type"];
    question: string;
    options?: string[];
    expectedAnswer: string;
    maxScore?: number;
    rubricCriteria?: AssignmentDetail["content"]["items"][number]["rubricCriteria"];
  };
  tags: TaskBankTag[];
}

function rubricToTextarea(
  criteria: AssignmentDetail["content"]["items"][number]["rubricCriteria"]
): string {
  if (!criteria || criteria.length === 0) return "";
  return criteria
    .map((c) => `${c.title} | ${c.description} | ${c.weight}`)
    .join("\n");
}

function parseRubricTextarea(
  value: string
): AssignmentDetail["content"]["items"][number]["rubricCriteria"] {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  return lines.map((line, idx) => {
    const [titleRaw, descriptionRaw, weightRaw] = line.split("|").map((part) => part.trim());
    const parsedWeight = Number.parseFloat(weightRaw ?? "");
    return {
      id: `criterion_${idx + 1}`,
      title: titleRaw || `Criterion ${idx + 1}`,
      description: descriptionRaw || "Demonstrates the expected understanding.",
      weight: Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 1,
      type: "EXPECTATION" as const,
    };
  });
}

function parseTagsInput(input: string): TaskBankTag[] {
  const chunks = input
    .split(/[\n,]/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const dedup = new Set<string>();
  const tags: TaskBankTag[] = [];
  for (const chunk of chunks) {
    const [rawKey, ...rest] = chunk.split(":");
    const key = rawKey?.trim();
    const value = rest.join(":").trim();
    if (!key || !value) {
      throw new Error(`Invalid tag: "${chunk}". Use key:value`);
    }
    const signature = `${key.toLowerCase()}::${value.toLowerCase()}`;
    if (dedup.has(signature)) continue;
    dedup.add(signature);
    tags.push({ key, value });
  }

  return tags;
}

export default function AssignmentEditor({ assignment }: Props) {
  const router = useRouter();
  const { load, content, isDirty, isSaving, saveError, setTitle, setInstructions,
    updateItem, addItem, removeItem, moveItem, markSaving, markSaved, markSaveError } =
    useEditorStore();

  const [changeDescription, setChangeDescription] = useState("");
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [showTaskBankPicker, setShowTaskBankPicker] = useState(false);
  const [taskBankSearch, setTaskBankSearch] = useState("");
  const [taskBankItems, setTaskBankItems] = useState<TaskBankItem[]>([]);
  const [taskBankLoading, setTaskBankLoading] = useState(false);
  const [taskBankError, setTaskBankError] = useState<string | null>(null);
  const [taskBankActionOrder, setTaskBankActionOrder] = useState<number | null>(null);
  const [taskBankSaveDraft, setTaskBankSaveDraft] = useState<{
    order: number;
    title: string;
    tags: string;
  } | null>(null);
  const [taskBankSaveMessage, setTaskBankSaveMessage] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      load(assignment.id, assignment.content);
      initialized.current = true;
    }
  }, [assignment.id, assignment.content, load]);

  useEffect(() => {
    if (!showTaskBankPicker) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      const load = async () => {
        setTaskBankLoading(true);
        setTaskBankError(null);
        try {
          const params = new URLSearchParams();
          if (taskBankSearch.trim()) params.set("search", taskBankSearch.trim());
          const query = params.toString();
          const res = await fetch(`/api/task-bank${query ? `?${query}` : ""}`, {
            signal: controller.signal,
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error ?? "Failed to load task bank");
          }
          setTaskBankItems(data.data as TaskBankItem[]);
        } catch (err) {
          if (controller.signal.aborted) return;
          setTaskBankError(
            err instanceof Error ? err.message : "Failed to load task bank"
          );
        } finally {
          if (!controller.signal.aborted) setTaskBankLoading(false);
        }
      };

      void load();
    }, 250);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [showTaskBankPicker, taskBankSearch]);

  const handleSave = async () => {
    markSaving();
    try {
      const res = await fetch(`/api/assignments/${assignment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, changeDescription: changeDescription || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        markSaveError(data.error ?? "Save failed");
        return;
      }
      markSaved();
      setChangeDescription("");
      router.refresh();
    } catch {
      markSaveError("Network error");
    }
  };

  const handlePublish = async () => {
    try {
      const res = await fetch(`/api/assignments/${assignment.id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        markSaveError(data.error ?? "Publish failed");
        return;
      }
      setPublishConfirm(false);
      router.refresh();
    } catch {
      markSaveError("Network error");
    }
  };

  const handleAddItem = () => {
    const nextOrder =
      content.items.reduce((max, item) => Math.max(max, item.order), 0) + 1;
    addItem({
      order: nextOrder,
      type: "SHORT_ANSWER",
      question: "",
      expectedAnswer: "",
      maxScore: 1,
      rubricCriteria: [
        {
          id: "criterion_1",
          title: "Expected answer coverage",
          description: "Covers the expected concept accurately.",
          weight: 1,
          type: "EXPECTATION",
        },
      ],
    });
  };

  const handleAddFromTaskBank = (
    task: TaskBankItem
  ) => {
    const nextOrder =
      content.items.reduce((max, item) => Math.max(max, item.order), 0) + 1;
    addItem({
      order: nextOrder,
      type: task.content.type,
      question: task.content.question,
      options: task.content.options,
      expectedAnswer: task.content.expectedAnswer,
      maxScore: task.content.maxScore ?? 1,
      rubricCriteria: task.content.rubricCriteria ?? [],
    });
  };

  const startSaveToTaskBank = (item: AssignmentDetail["content"]["items"][number]) => {
    setTaskBankSaveMessage(null);
    setTaskBankError(null);
    setTaskBankSaveDraft({
      order: item.order,
      title: item.question.slice(0, 120) || `Assignment ${assignment.id} Q${item.order}`,
      tags: `source:assignment, assignmentId:${assignment.id}`,
    });
  };

  const handleSaveToTaskBank = async (
    item: AssignmentDetail["content"]["items"][number]
  ) => {
    if (!taskBankSaveDraft || taskBankSaveDraft.order !== item.order) return;
    if (!taskBankSaveDraft.title.trim()) {
      setTaskBankError("Task title is required");
      return;
    }

    setTaskBankActionOrder(item.order);
    setTaskBankError(null);
    setTaskBankSaveMessage(null);
    try {
      const res = await fetch("/api/task-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskBankSaveDraft.title.trim(),
          content: {
            type: item.type,
            question: item.question,
            options: item.options ?? undefined,
            expectedAnswer: item.expectedAnswer,
            maxScore: item.maxScore ?? 1,
            rubricCriteria: item.rubricCriteria ?? [],
          },
          tags: parseTagsInput(taskBankSaveDraft.tags),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Failed to save task to bank");
      }
      setTaskBankSaveMessage("Saved to Task Bank");
      setTaskBankSaveDraft(null);
    } catch (err) {
      setTaskBankError(err instanceof Error ? err.message : "Failed to save task to bank");
    } finally {
      setTaskBankActionOrder(null);
    }
  };

  const isAssigned = assignment.status === "ASSIGNED";

  return (
    <div className="space-y-6">
      {/* Title & instructions */}
      <div className="p-5 border rounded-lg space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Title</label>
          <input
            className="w-full border rounded px-3 py-2 text-sm disabled:bg-slate-900/60"
            value={content.title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isAssigned}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Instructions</label>
          <textarea
            className="w-full border rounded px-3 py-2 text-sm resize-none disabled:bg-slate-900/60"
            rows={3}
            value={content.instructions}
            onChange={(e) => setInstructions(e.target.value)}
            disabled={isAssigned}
          />
        </div>
      </div>

      {/* Items */}
      <div className="space-y-3">
        {!isAssigned && (
          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-300">
                Reuse existing tasks from Task Bank or save current questions there.
              </p>
              <button
                type="button"
                onClick={() => setShowTaskBankPicker((prev) => !prev)}
                className="px-3 py-1.5 border rounded text-sm font-medium text-slate-300 hover:bg-slate-900/60"
              >
                {showTaskBankPicker ? "Hide Task Bank" : "Add from Task Bank"}
              </button>
            </div>

            {showTaskBankPicker && (
              <div className="space-y-3">
                <input
                  type="search"
                  value={taskBankSearch}
                  onChange={(e) => setTaskBankSearch(e.target.value)}
                  placeholder="Search task bank"
                  className="w-full border rounded px-3 py-2 text-sm"
                />
                <div className="max-h-56 overflow-y-auto border rounded divide-y">
                  {taskBankLoading ? (
                    <p className="px-3 py-4 text-sm text-slate-400">Loading tasks...</p>
                  ) : taskBankError ? (
                    <p className="px-3 py-4 text-sm text-red-300">{taskBankError}</p>
                  ) : taskBankItems.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-slate-400">No tasks found.</p>
                  ) : (
                    taskBankItems.map((task) => (
                      <div key={task.id} className="px-3 py-2 space-y-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            <p className="text-xs text-slate-500">
                              {task.content.type.replace("_", " ")}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddFromTaskBank(task)}
                            className="px-2.5 py-1 border rounded text-xs font-medium text-slate-300 hover:bg-slate-900/60"
                          >
                            Add
                          </button>
                        </div>
                        <p className="text-xs text-slate-400">{task.content.question}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {content.items
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((item) => (
            <div key={item.order} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 w-6">Q{item.order}</span>
                <select
                  className="border rounded px-2 py-1 text-xs disabled:bg-slate-900/60"
                  value={item.type}
                  onChange={(e) =>
                    updateItem(item.order, {
                      type: e.target.value as typeof item.type,
                    })
                  }
                  disabled={isAssigned}
                >
                  <option value="SHORT_ANSWER">Short Answer</option>
                  <option value="MULTIPLE_CHOICE">Multiple Choice</option>
                  <option value="LONG_ANSWER">Long Answer</option>
                </select>
                <div className="ml-auto flex gap-1">
                  {!isAssigned && (
                    <button
                      type="button"
                      onClick={() => startSaveToTaskBank(item)}
                      disabled={taskBankActionOrder === item.order}
                      className="px-2 py-1 text-xs border rounded hover:bg-slate-900/60 disabled:opacity-30"
                    >
                      Save to Bank
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => moveItem(item.order, "up")}
                    disabled={item.order === 1 || isAssigned}
                    aria-label="Move question up"
                    title="Move up"
                    className="px-2 py-1 text-xs border rounded hover:bg-slate-900/60 disabled:opacity-30"
                  >
                    ^
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(item.order, "down")}
                    disabled={item.order === content.items.length || isAssigned}
                    aria-label="Move question down"
                    title="Move down"
                    className="px-2 py-1 text-xs border rounded hover:bg-slate-900/60 disabled:opacity-30"
                  >
                    v
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item.order)}
                    disabled={isAssigned}
                    aria-label="Remove question"
                    title="Remove"
                    className="px-2 py-1 text-xs border border-red-500/35 text-red-300 rounded hover:bg-red-500/10 disabled:opacity-30"
                  >
                    x
                  </button>
                </div>
              </div>
              {taskBankSaveDraft?.order === item.order && (
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-sm">
                      <span className="mb-1 block text-xs text-slate-400">Task title</span>
                      <input
                        value={taskBankSaveDraft.title}
                        onChange={(e) =>
                          setTaskBankSaveDraft({ ...taskBankSaveDraft, title: e.target.value })
                        }
                        className="w-full rounded border px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="text-sm">
                      <span className="mb-1 block text-xs text-slate-400">Tags</span>
                      <input
                        value={taskBankSaveDraft.tags}
                        onChange={(e) =>
                          setTaskBankSaveDraft({ ...taskBankSaveDraft, tags: e.target.value })
                        }
                        className="w-full rounded border px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveToTaskBank(item)}
                      disabled={taskBankActionOrder === item.order}
                      className="px-3 py-1.5 rounded workspace-primary-action text-xs font-medium text-white  disabled:opacity-50"
                    >
                      {taskBankActionOrder === item.order ? "Saving..." : "Save task"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTaskBankSaveDraft(null)}
                      disabled={taskBankActionOrder === item.order}
                      className="px-3 py-1.5 rounded border text-xs font-medium hover:bg-slate-900/60 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {taskBankSaveMessage && <p className="text-xs text-emerald-300" aria-live="polite">{taskBankSaveMessage}</p>}
              {taskBankError && <p className="text-xs text-red-300" aria-live="polite">{taskBankError}</p>}

              <div>
                <label className="block text-xs text-slate-400 mb-1">Question</label>
                <textarea
                  className="w-full border rounded px-3 py-2 text-sm resize-none disabled:bg-slate-900/60"
                  rows={2}
                  value={item.question}
                  onChange={(e) => updateItem(item.order, { question: e.target.value })}
                  disabled={isAssigned}
                />
              </div>

              {item.type === "MULTIPLE_CHOICE" && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Options (one per line)
                  </label>
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm resize-none font-mono disabled:bg-slate-900/60"
                    rows={3}
                    value={(item.options ?? []).join("\n")}
                    onChange={(e) =>
                      updateItem(item.order, {
                        options: e.target.value
                          .split("\n")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    disabled={isAssigned}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs text-slate-400 mb-1">Expected Answer</label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm disabled:bg-slate-900/60"
                  value={item.expectedAnswer}
                  onChange={(e) => updateItem(item.order, { expectedAnswer: e.target.value })}
                  disabled={isAssigned}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Max Score</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    className="w-full border rounded px-3 py-2 text-sm disabled:bg-slate-900/60"
                    value={item.maxScore ?? 1}
                    onChange={(e) =>
                      updateItem(item.order, {
                        maxScore: Number.parseFloat(e.target.value) || 1,
                      })
                    }
                    disabled={isAssigned}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Rubric Criteria (one per line: Title | Description | Weight)
                  </label>
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm resize-none disabled:bg-slate-900/60"
                    rows={4}
                    value={rubricToTextarea(item.rubricCriteria)}
                    onChange={(e) =>
                      updateItem(item.order, {
                        rubricCriteria: parseRubricTextarea(e.target.value),
                      })
                    }
                    disabled={isAssigned}
                  />
                </div>
              </div>
            </div>
          ))}

        {!isAssigned && (
          <button
            type="button"
            onClick={handleAddItem}
            className="w-full py-3 border-2 border-dashed rounded-lg text-sm text-slate-400 hover:border-[color:var(--color-blue-400)]/60 hover:text-[color:var(--color-blue-200)]"
          >
            + Add Question
          </button>
        )}
      </div>

      {/* Save controls */}
      {!isAssigned && (
        <div className="p-4 border rounded-lg space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Change description (optional)
            </label>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="What changed in this version?"
              value={changeDescription}
              onChange={(e) => setChangeDescription(e.target.value)}
            />
          </div>
          <div className="flex gap-3 items-center">
            <button
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className="px-4 py-2 workspace-primary-action text-white rounded text-sm font-medium  disabled:opacity-40"
            >
              {isSaving ? "Saving..." : "Save Version"}
            </button>

            {saveError && (
              <p className="text-sm text-red-300">{saveError}</p>
            )}

            {isDirty && (
              <p className="ml-auto text-xs text-[color:var(--color-blue-200)]">Unsaved changes</p>
            )}
          </div>
        </div>
      )}

      {/* Publish */}
      {assignment.status !== "PUBLISHABLE" && assignment.status !== "ASSIGNED" && (
        <div className="p-4 border border-emerald-500/35 rounded-lg bg-emerald-500/10">
          <p className="text-sm text-emerald-300 mb-3">
            Save all changes before publishing. Publishing marks this assignment as ready for
            distribution. Content will revert to DRAFT if you edit after publishing.
          </p>
          {!publishConfirm ? (
            <button
              onClick={() => setPublishConfirm(true)}
              disabled={isDirty}
              className="px-4 py-2 bg-emerald-500 text-slate-950 rounded text-sm font-medium hover:bg-emerald-400 disabled:opacity-40"
            >
              Mark as Publishable
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handlePublish}
                className="px-4 py-2 bg-emerald-500 text-slate-950 rounded text-sm font-medium hover:bg-emerald-400"
              >
                Confirm Publish
              </button>
              <button
                onClick={() => setPublishConfirm(false)}
                className="px-4 py-2 border rounded text-sm font-medium text-slate-300 hover:bg-slate-900/60"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {assignment.status === "PUBLISHABLE" && (
        <div className="p-4 border border-emerald-500/35 rounded-lg bg-emerald-500/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-emerald-300 font-medium">
              This assignment is ready to distribute.
            </p>
            <Link
              href={`/dashboard/assignments/${assignment.id}/assign`}
              className="px-4 py-2 bg-emerald-500 text-slate-950 rounded text-sm font-medium hover:bg-emerald-400"
            >
              Assign to Students
            </Link>
          </div>
        </div>
      )}

      {assignment.status === "ASSIGNED" && (
        <div className="p-4 border border-[color:var(--color-blue-500)]/35 rounded-lg bg-[color:var(--color-blue-500)]/10">
          <p className="text-sm text-[color:var(--color-blue-200)] font-medium">
            This assignment has been assigned to students and cannot be edited.
          </p>
        </div>
      )}
    </div>
  );
}

