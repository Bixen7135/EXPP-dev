"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  EmptyState,
  ErrorState,
  PageHero,
  SectionPanel,
  SkeletonRows,
  StatusBadge,
  WorkspacePage,
  dangerButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/dashboard/workspace-ui";

type BankTab = "tasks" | "worksheets";
type AssignmentStatus = "DRAFT" | "PUBLISHABLE" | "ASSIGNED";
type TaskType = "SHORT_ANSWER" | "MULTIPLE_CHOICE" | "LONG_ANSWER";

interface KeyValueTag {
  key: string;
  value: string;
}

interface TaskBankItem {
  id: string;
  title: string;
  content: {
    type: TaskType;
    question: string;
    options?: string[];
    expectedAnswer: string;
    maxScore?: number;
  };
  tags: KeyValueTag[];
  updatedAt: string;
}

interface WorksheetBankItem {
  id: string;
  title: string;
  status: AssignmentStatus;
  tags: KeyValueTag[];
  updatedAt: string;
}

const STATUS_COLORS: Record<AssignmentStatus, string> = {
  DRAFT: "neutral",
  PUBLISHABLE: "green",
  ASSIGNED: "blue",
};

const TYPE_OPTIONS: TaskType[] = ["SHORT_ANSWER", "MULTIPLE_CHOICE", "LONG_ANSWER"];

interface TaskDraft {
  id: string;
  title: string;
  type: TaskType;
  question: string;
  expectedAnswer: string;
  options: string;
  maxScore: string;
  tagsText: string;
}

export default function BanksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tab: BankTab = searchParams.get("tab") === "worksheets" ? "worksheets" : "tasks";
  const [search, setSearch] = useState("");
  const [tagKey, setTagKey] = useState("");
  const [tagValue, setTagValue] = useState("");

  const [tasks, setTasks] = useState<TaskBankItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskActionLoadingId, setTaskActionLoadingId] = useState<string | null>(null);

  const [worksheets, setWorksheets] = useState<WorksheetBankItem[]>([]);
  const [worksheetsLoading, setWorksheetsLoading] = useState(false);
  const [worksheetsError, setWorksheetsError] = useState<string | null>(null);
  const [worksheetActionLoadingId, setWorksheetActionLoadingId] = useState<string | null>(
    null
  );
  const [worksheetTagDrafts, setWorksheetTagDrafts] = useState<Record<string, string>>({});

  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<TaskType>("SHORT_ANSWER");
  const [newQuestion, setNewQuestion] = useState("");
  const [newExpectedAnswer, setNewExpectedAnswer] = useState("");
  const [newOptions, setNewOptions] = useState("");
  const [newMaxScore, setNewMaxScore] = useState("1");
  const [newTagsText, setNewTagsText] = useState("");
  const [newTaskError, setNewTaskError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<TaskDraft | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (tagKey.trim()) params.set("tagKey", tagKey.trim());
    if (tagValue.trim()) params.set("tagValue", tagValue.trim());
    const query = params.toString();
    return query ? `?${query}` : "";
  }, [search, tagKey, tagValue]);

  useEffect(() => {
    if (tab === "tasks") {
      void loadTasks(queryString);
      return;
    }

    void loadWorksheets(queryString);
  }, [tab, queryString]);

  useEffect(() => {
    if (worksheets.length === 0) return;
    setWorksheetTagDrafts((prev) => {
      const next = { ...prev };
      for (const worksheet of worksheets) {
        if (!next[worksheet.id]) {
          next[worksheet.id] = tagsToInput(worksheet.tags);
        }
      }
      return next;
    });
  }, [worksheets]);

  function handleTabChange(nextTab: BankTab) {
    if (nextTab === tab) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`/dashboard/banks?${params.toString()}`, { scroll: false });
  }

  async function loadTasks(query: string) {
    setTasksLoading(true);
    setTasksError(null);
    try {
      const res = await fetch(`/api/task-bank${query}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load tasks");
      }
      setTasks(json.data as TaskBankItem[]);
    } catch (err) {
      setTasksError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setTasksLoading(false);
    }
  }

  async function loadWorksheets(query: string) {
    setWorksheetsLoading(true);
    setWorksheetsError(null);
    try {
      const res = await fetch(`/api/worksheet-bank${query}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to load worksheets");
      }
      setWorksheets(json.data as WorksheetBankItem[]);
    } catch (err) {
      setWorksheetsError(
        err instanceof Error ? err.message : "Failed to load worksheets"
      );
    } finally {
      setWorksheetsLoading(false);
    }
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    setNewTaskError(null);

    setTaskSubmitting(true);
    try {
      const parsedTags = parseTags(newTagsText);
      const parsedMaxScore = Number.parseFloat(newMaxScore);
      const res = await fetch("/api/task-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          content: {
            type: newType,
            question: newQuestion,
            options:
              newType === "MULTIPLE_CHOICE"
                ? newOptions
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                : undefined,
            expectedAnswer: newExpectedAnswer,
            maxScore: Number.isFinite(parsedMaxScore) && parsedMaxScore > 0 ? parsedMaxScore : 1,
          },
          tags: parsedTags,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to create task");
      }

      setNewTitle("");
      setNewQuestion("");
      setNewExpectedAnswer("");
      setNewOptions("");
      setNewMaxScore("1");
      setNewTagsText("");
      await loadTasks(queryString);
    } catch (err) {
      setNewTaskError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setTaskSubmitting(false);
    }
  }

  async function handleDeleteTask(taskId: string) {
    setActionError(null);
    setTaskActionLoadingId(taskId);
    try {
      const res = await fetch(`/api/task-bank/${taskId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to delete task");
      }
      await loadTasks(queryString);
      setDeleteTaskId(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete task");
    } finally {
      setTaskActionLoadingId(null);
    }
  }

  function startEditTask(task: TaskBankItem) {
    setActionError(null);
    setEditingTask({
      id: task.id,
      title: task.title,
      type: task.content.type,
      question: task.content.question,
      expectedAnswer: task.content.expectedAnswer,
      options: (task.content.options ?? []).join("\n"),
      maxScore: String(task.content.maxScore ?? 1),
      tagsText: tagsToInput(task.tags),
    });
  }

  async function handleEditTask(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTask) return;

    setActionError(null);
    setTaskActionLoadingId(editingTask.id);
    try {
      const parsedMaxScore = Number.parseFloat(editingTask.maxScore);
      const res = await fetch(`/api/task-bank/${editingTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editingTask.title,
          content: {
            type: editingTask.type,
            question: editingTask.question,
            options:
              editingTask.type === "MULTIPLE_CHOICE"
                ? editingTask.options
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                : undefined,
            expectedAnswer: editingTask.expectedAnswer,
            maxScore:
              Number.isFinite(parsedMaxScore) && parsedMaxScore > 0
                ? parsedMaxScore
                : 1,
          },
          tags: parseTags(editingTask.tagsText),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to update task");
      }
      await loadTasks(queryString);
      setEditingTask(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update task");
    } finally {
      setTaskActionLoadingId(null);
    }
  }

  async function handleWorksheetEdit(item: WorksheetBankItem) {
    if (item.status !== "ASSIGNED") {
      router.push(`/dashboard/assignments/${item.id}/edit`);
      return;
    }

    setWorksheetActionLoadingId(item.id);
    try {
      const res = await fetch(`/api/worksheet-bank/${item.id}/duplicate`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to create editable copy");
      }
      router.push(`/dashboard/assignments/${json.data.id}/edit`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to open worksheet");
    } finally {
      setWorksheetActionLoadingId(null);
    }
  }

  async function handleWorksheetDuplicate(item: WorksheetBankItem) {
    setWorksheetActionLoadingId(item.id);
    try {
      const res = await fetch(`/api/worksheet-bank/${item.id}/duplicate`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to duplicate worksheet");
      }
      await loadWorksheets(queryString);
      router.push(`/dashboard/assignments/${json.data.id}/edit`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to duplicate worksheet");
    } finally {
      setWorksheetActionLoadingId(null);
    }
  }

  async function handleWorksheetTagSave(worksheetId: string) {
    const input = worksheetTagDrafts[worksheetId] ?? "";
    setWorksheetActionLoadingId(worksheetId);
    try {
      const res = await fetch(`/api/worksheet-bank/${worksheetId}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: parseTags(input) }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error ?? "Failed to update tags");
      }
      await loadWorksheets(queryString);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update tags");
    } finally {
      setWorksheetActionLoadingId(null);
    }
  }

  return (
    <WorkspacePage>
      <PageHero
        title="Banks"
        actions={<Link href="/dashboard/generate" className={primaryButtonClass()}>Generate assignment</Link>}
      />

      {actionError ? <ErrorState message={actionError} /> : null}

      <SectionPanel title="Search and filters" description="Filter by text, tag key, or tag value without leaving the current bank.">
        <div className="flex flex-wrap items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => handleTabChange("tasks")}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              tab === "tasks"
                ? "workspace-primary-action"
                : "border border-slate-700 text-slate-300 hover:bg-slate-900/60"
            }`}
          >
            Tasks
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("worksheets")}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              tab === "worksheets"
                ? "workspace-primary-action"
                : "border border-slate-700 text-slate-300 hover:bg-slate-900/60"
            }`}
          >
            Worksheets
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search text"
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            value={tagKey}
            onChange={(e) => setTagKey(e.target.value)}
            placeholder="Tag key (e.g. topic)"
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            value={tagValue}
            onChange={(e) => setTagValue(e.target.value)}
            placeholder="Tag value (e.g. algebra)"
            className="border rounded px-3 py-2 text-sm"
          />
        </div>
      </SectionPanel>

      {tab === "tasks" ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <SectionPanel title="Add task" description="Create a reusable task with optional tags.">
          <form onSubmit={handleCreateTask} className="space-y-3">
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-400">Task title</span>
            <input
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-400">Question type</span>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as TaskType)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              {TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type.replace("_", " ")}
                </option>
              ))}
            </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-400">Question</span>
            <textarea
              required
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="Question"
              className="w-full border rounded px-3 py-2 text-sm"
              rows={3}
            />
            </label>
            {newType === "MULTIPLE_CHOICE" && (
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-slate-400">Options</span>
              <textarea
                value={newOptions}
                onChange={(e) => setNewOptions(e.target.value)}
                placeholder="Options, one per line"
                className="w-full border rounded px-3 py-2 text-sm"
                rows={3}
              />
              </label>
            )}
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-400">Expected answer</span>
            <input
              required
              value={newExpectedAnswer}
              onChange={(e) => setNewExpectedAnswer(e.target.value)}
              placeholder="Expected answer"
              className="w-full border rounded px-3 py-2 text-sm"
            />
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-slate-400">Max score</span>
              <input
                value={newMaxScore}
                onChange={(e) => setNewMaxScore(e.target.value)}
                placeholder="Max score"
                className="border rounded px-3 py-2 text-sm"
              />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs text-slate-400">Tags</span>
              <input
                value={newTagsText}
                onChange={(e) => setNewTagsText(e.target.value)}
                placeholder="Tags: key:value, key2:value2"
                className="border rounded px-3 py-2 text-sm"
              />
              </label>
            </div>

            {newTaskError && <p className="text-sm text-red-300" aria-live="polite">{newTaskError}</p>}

            <button
              type="submit"
              disabled={taskSubmitting}
              className={primaryButtonClass()}
            >
              {taskSubmitting ? "Saving..." : "Save Task"}
            </button>
          </form>
          </SectionPanel>

          <SectionPanel title="Task bank" description="Edit, delete, and reuse task items without modal prompts.">
            {tasksLoading ? (
              <SkeletonRows />
            ) : tasksError ? (
              <ErrorState message={tasksError} action={<button type="button" className={secondaryButtonClass()} onClick={() => loadTasks(queryString)}>Retry</button>} />
            ) : tasks.length === 0 ? (
              <EmptyState title="No tasks found" description="Adjust the filters or add the first reusable task." />
            ) : (
              <ul className="divide-y">
                {tasks.map((task) => (
                  <li key={task.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{task.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {task.content.type.replace("_", " ")} Â· Updated{" "}
                          {new Date(task.updatedAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditTask(task)}
                          disabled={taskActionLoadingId === task.id}
                          className={secondaryButtonClass()}
                        >
                          Edit
                        </button>
                        {deleteTaskId === task.id ? (
                          <span className="inline-flex items-center gap-2">
                            <button type="button" className={dangerButtonClass()} disabled={taskActionLoadingId === task.id} onClick={() => handleDeleteTask(task.id)}>
                              Confirm delete
                            </button>
                            <button type="button" className={secondaryButtonClass()} disabled={taskActionLoadingId === task.id} onClick={() => setDeleteTaskId(null)}>
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button type="button" onClick={() => setDeleteTaskId(task.id)} disabled={taskActionLoadingId === task.id} className={dangerButtonClass()}>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    {editingTask?.id === task.id ? (
                      <form onSubmit={handleEditTask} className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="text-sm">
                            <span className="mb-1 block text-xs text-slate-400">Title</span>
                            <input required value={editingTask.title} onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" />
                          </label>
                          <label className="text-sm">
                            <span className="mb-1 block text-xs text-slate-400">Type</span>
                            <select value={editingTask.type} onChange={(e) => setEditingTask({ ...editingTask, type: e.target.value as TaskType })} className="w-full rounded border px-3 py-2 text-sm">
                              {TYPE_OPTIONS.map((type) => (
                                <option key={type} value={type}>{type.replace("_", " ")}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <label className="block text-sm">
                          <span className="mb-1 block text-xs text-slate-400">Question</span>
                          <textarea required value={editingTask.question} onChange={(e) => setEditingTask({ ...editingTask, question: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" rows={3} />
                        </label>
                        {editingTask.type === "MULTIPLE_CHOICE" ? (
                          <label className="block text-sm">
                            <span className="mb-1 block text-xs text-slate-400">Options</span>
                            <textarea value={editingTask.options} onChange={(e) => setEditingTask({ ...editingTask, options: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" rows={3} />
                          </label>
                        ) : null}
                        <div className="grid gap-3 md:grid-cols-3">
                          <label className="text-sm md:col-span-2">
                            <span className="mb-1 block text-xs text-slate-400">Expected answer</span>
                            <input required value={editingTask.expectedAnswer} onChange={(e) => setEditingTask({ ...editingTask, expectedAnswer: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" />
                          </label>
                          <label className="text-sm">
                            <span className="mb-1 block text-xs text-slate-400">Max score</span>
                            <input value={editingTask.maxScore} onChange={(e) => setEditingTask({ ...editingTask, maxScore: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" />
                          </label>
                        </div>
                        <label className="block text-sm">
                          <span className="mb-1 block text-xs text-slate-400">Tags</span>
                          <input value={editingTask.tagsText} onChange={(e) => setEditingTask({ ...editingTask, tagsText: e.target.value })} className="w-full rounded border px-3 py-2 text-sm" />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button type="submit" className={primaryButtonClass()} disabled={taskActionLoadingId === task.id}>Save changes</button>
                          <button type="button" className={secondaryButtonClass()} disabled={taskActionLoadingId === task.id} onClick={() => setEditingTask(null)}>Cancel</button>
                        </div>
                      </form>
                    ) : null}
                    <p className="text-sm text-slate-300">{task.content.question}</p>
                    <p className="text-xs text-slate-400">
                      Expected: {task.content.expectedAnswer}
                    </p>
                    {task.tags.length > 0 && (
                      <p className="text-xs text-slate-400">
                        Tags: {task.tags.map((tag) => `${tag.key}:${tag.value}`).join(" | ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </SectionPanel>
        </section>
      ) : (
        <SectionPanel title="Worksheet bank" description="Drafts and assigned worksheets can be duplicated, assigned, and tagged.">
          {worksheetsLoading ? (
            <SkeletonRows />
          ) : worksheetsError ? (
            <ErrorState message={worksheetsError} action={<button type="button" className={secondaryButtonClass()} onClick={() => loadWorksheets(queryString)}>Retry</button>} />
          ) : worksheets.length === 0 ? (
            <EmptyState title="No worksheets found" description="Adjust the filters or generate a worksheet draft first." />
          ) : (
            <ul className="divide-y">
              {worksheets.map((item) => (
                <li key={item.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{item.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Updated {new Date(item.updatedAt).toLocaleString()}
                      </p>
                    </div>
                    <span
                      className="hidden"
                    />
                    <StatusBadge tone={STATUS_COLORS[item.status] as "neutral" | "green" | "blue"}>{item.status}</StatusBadge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleWorksheetEdit(item)}
                      disabled={worksheetActionLoadingId === item.id}
                      className={secondaryButtonClass()}
                    >
                      Edit
                    </button>
                    <Link
                      href={`/dashboard/assignments/${item.id}/assign`}
                      className={secondaryButtonClass()}
                    >
                      Assign
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleWorksheetDuplicate(item)}
                      disabled={worksheetActionLoadingId === item.id}
                      className={secondaryButtonClass()}
                    >
                      Duplicate
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2">
                    <input
                      value={worksheetTagDrafts[item.id] ?? ""}
                      onChange={(e) =>
                        setWorksheetTagDrafts((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      className="border rounded px-3 py-2 text-sm"
                      placeholder="Tags: key:value, key2:value2"
                    />
                    <button
                      type="button"
                      onClick={() => handleWorksheetTagSave(item.id)}
                      disabled={worksheetActionLoadingId === item.id}
                      className={secondaryButtonClass()}
                    >
                      Edit Tags
                    </button>
                  </div>

                  {item.tags.length > 0 && (
                    <p className="text-xs text-slate-400">
                      Current tags: {item.tags.map((tag) => `${tag.key}:${tag.value}`).join(" | ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>
      )}
    </WorkspacePage>
  );
}

function parseTags(input: string): KeyValueTag[] {
  const chunks = input
    .split(/[\n,]/g)
    .map((value) => value.trim())
    .filter(Boolean);

  const tags: KeyValueTag[] = [];
  const dedup = new Set<string>();
  for (const chunk of chunks) {
    const [rawKey, ...rest] = chunk.split(":");
    const key = rawKey?.trim();
    const value = rest.join(":").trim();
    if (!key || !value) {
      throw new Error(`Invalid tag format: "${chunk}". Use key:value`);
    }
    const signature = `${key.toLowerCase()}::${value.toLowerCase()}`;
    if (dedup.has(signature)) continue;
    dedup.add(signature);
    tags.push({ key, value });
  }

  return tags;
}

function tagsToInput(tags: KeyValueTag[]): string {
  return tags.map((tag) => `${tag.key}:${tag.value}`).join(", ");
}
