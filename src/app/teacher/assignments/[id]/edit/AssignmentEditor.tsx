"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditorStore } from "@/modules/assignments/editor-store";
import type { AssignmentDetail } from "@/modules/assignments/types";

interface Props {
  assignment: AssignmentDetail;
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

export default function AssignmentEditor({ assignment }: Props) {
  const router = useRouter();
  const { load, content, isDirty, isSaving, saveError, setTitle, setInstructions,
    updateItem, addItem, removeItem, moveItem, markSaving, markSaved, markSaveError } =
    useEditorStore();

  const [changeDescription, setChangeDescription] = useState("");
  const [publishConfirm, setPublishConfirm] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      load(assignment.id, assignment.content);
      initialized.current = true;
    }
  }, [assignment.id, assignment.content, load]);

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
        alert(data.error ?? "Publish failed");
        return;
      }
      setPublishConfirm(false);
      router.refresh();
    } catch {
      alert("Network error");
    }
  };

  const handleAddItem = () => {
    const nextOrder = content.items.length + 1;
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

  const isAssigned = assignment.status === "ASSIGNED";

  return (
    <div className="space-y-6">
      {/* Title & instructions */}
      <div className="p-5 border rounded-lg space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-50"
            value={content.title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isAssigned}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
          <textarea
            className="w-full border rounded px-3 py-2 text-sm resize-none disabled:bg-gray-50"
            rows={3}
            value={content.instructions}
            onChange={(e) => setInstructions(e.target.value)}
            disabled={isAssigned}
          />
        </div>
      </div>

      {/* Items */}
      <div className="space-y-3">
        {content.items
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((item) => (
            <div key={item.order} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-400 w-6">Q{item.order}</span>
                <select
                  className="border rounded px-2 py-1 text-xs disabled:bg-gray-50"
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
                  <button
                    onClick={() => moveItem(item.order, "up")}
                    disabled={item.order === 1 || isAssigned}
                    className="px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveItem(item.order, "down")}
                    disabled={item.order === content.items.length || isAssigned}
                    className="px-2 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeItem(item.order)}
                    disabled={isAssigned}
                    className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-30"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Question</label>
                <textarea
                  className="w-full border rounded px-3 py-2 text-sm resize-none disabled:bg-gray-50"
                  rows={2}
                  value={item.question}
                  onChange={(e) => updateItem(item.order, { question: e.target.value })}
                  disabled={isAssigned}
                />
              </div>

              {item.type === "MULTIPLE_CHOICE" && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Options (one per line)
                  </label>
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm resize-none font-mono disabled:bg-gray-50"
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
                <label className="block text-xs text-gray-500 mb-1">Expected Answer</label>
                <input
                  className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-50"
                  value={item.expectedAnswer}
                  onChange={(e) => updateItem(item.order, { expectedAnswer: e.target.value })}
                  disabled={isAssigned}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max Score</label>
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-50"
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
                  <label className="block text-xs text-gray-500 mb-1">
                    Rubric Criteria (one per line: Title | Description | Weight)
                  </label>
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm resize-none disabled:bg-gray-50"
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
            onClick={handleAddItem}
            className="w-full py-3 border-2 border-dashed rounded-lg text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600"
          >
            + Add Question
          </button>
        )}
      </div>

      {/* Save controls */}
      {!isAssigned && (
        <div className="p-4 border rounded-lg space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
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
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
            >
              {isSaving ? "Saving…" : "Save Version"}
            </button>

            {saveError && (
              <p className="text-sm text-red-600">{saveError}</p>
            )}

            {isDirty && (
              <p className="text-xs text-amber-600 ml-auto">Unsaved changes</p>
            )}
          </div>
        </div>
      )}

      {/* Publish */}
      {assignment.status !== "PUBLISHABLE" && assignment.status !== "ASSIGNED" && (
        <div className="p-4 border border-green-200 rounded-lg bg-green-50">
          <p className="text-sm text-green-800 mb-3">
            Save all changes before publishing. Publishing marks this assignment as ready for
            distribution. Content will revert to DRAFT if you edit after publishing.
          </p>
          {!publishConfirm ? (
            <button
              onClick={() => setPublishConfirm(true)}
              disabled={isDirty}
              className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-40"
            >
              Mark as Publishable
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={handlePublish}
                className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
              >
                Confirm Publish
              </button>
              <button
                onClick={() => setPublishConfirm(false)}
                className="px-4 py-2 border rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {assignment.status === "PUBLISHABLE" && (
        <div className="p-4 border border-green-300 rounded-lg bg-green-50">
          <p className="text-sm text-green-800 font-medium">
            This assignment is publishable and ready for distribution → Phase 5
          </p>
        </div>
      )}

      {assignment.status === "ASSIGNED" && (
        <div className="p-4 border border-blue-200 rounded-lg bg-blue-50">
          <p className="text-sm text-blue-800 font-medium">
            This assignment has been assigned to students and cannot be edited.
          </p>
        </div>
      )}
    </div>
  );
}
