"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AI_HELP_MODE_LABELS,
  AI_HELP_MODE_DESCRIPTIONS,
  MANDATORY_GRADED_ALLOWED_MODES,
} from "@/modules/ai-help/mode-definitions";
import type { AiHelpMode } from "@/modules/ai-help/mode-definitions";
import type { AssignmentVersionSummary } from "@/modules/assignments/types";
import type { AssignableStudentSummary } from "@/modules/distribution/types";

const ALL_MODES: AiHelpMode[] = ["NO_HELP", "CLARIFICATION", "GUIDED", "POST_ASSESSMENT"];
type WorkspaceMode = "STANDARD" | "RESTRICTED";

interface Props {
  assignmentId: string;
  currentVersionId: string | null;
  versions: AssignmentVersionSummary[];
  students: AssignableStudentSummary[];
}

export default function AssignForm({ assignmentId, currentVersionId, versions, students }: Props) {
  const router = useRouter();
  const [versionId, setVersionId] = useState(currentVersionId ?? versions[0]?.id ?? "");
  const [deadline, setDeadline] = useState("");
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("STANDARD");
  const [distributionStatus, setDistributionStatus] = useState<"MANDATORY" | "PRACTICE">(
    "MANDATORY"
  );
  const [isGraded, setIsGraded] = useState(true);
  const [aiHelpMode, setAiHelpMode] = useState<AiHelpMode>("NO_HELP");
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRestrictedMode = workspaceMode === "RESTRICTED";
  const effectiveDistributionStatus = isRestrictedMode ? "MANDATORY" : distributionStatus;
  const effectiveIsGraded = isRestrictedMode ? true : isGraded;
  const isMandatoryGraded = effectiveDistributionStatus === "MANDATORY" && effectiveIsGraded;
  const allowedModes = isMandatoryGraded ? MANDATORY_GRADED_ALLOWED_MODES : ALL_MODES;

  const selectedStudentSet = useMemo(() => new Set(selectedStudentIds), [selectedStudentIds]);
  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return students;

    return students.filter((student) =>
      [student.name, student.email, student.id].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  }, [studentSearch, students]);

  const filteredSelectedCount = filteredStudents.reduce(
    (count, student) => count + (selectedStudentSet.has(student.id) ? 1 : 0),
    0
  );
  const allFilteredSelected =
    filteredStudents.length > 0 && filteredSelectedCount === filteredStudents.length;

  // If current mode is no longer allowed after status/graded change, reset.
  // Restricted mode hard-locks to NO_HELP.
  const effectiveMode: AiHelpMode = isRestrictedMode
    ? "NO_HELP"
    : allowedModes.includes(aiHelpMode)
    ? aiHelpMode
    : "NO_HELP";

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const toggleFilteredStudents = () => {
    if (filteredStudents.length === 0) return;

    setSelectedStudentIds((prev) => {
      const prevSet = new Set(prev);
      const filteredIds = filteredStudents.map((student) => student.id);
      const areAllFilteredSelected = filteredIds.every((id) => prevSet.has(id));

      if (areAllFilteredSelected) {
        const filteredSet = new Set(filteredIds);
        return prev.filter((id) => !filteredSet.has(id));
      }

      filteredIds.forEach((id) => prevSet.add(id));
      return Array.from(prevSet);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const ids = selectedStudentIds;

    if (ids.length === 0) {
      setError("Select at least one student.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/distribution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          versionId,
          deadline: deadline || null,
          distributionStatus: effectiveDistributionStatus,
          isGraded: effectiveIsGraded,
          aiHelpMode: effectiveMode,
          restrictedMode: isRestrictedMode,
          recipientUserIds: ids,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to create distribution");
        return;
      }
      router.push(`/dashboard/distribution/${data.data.id}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl">
      {/* Version */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">Version to assign</label>
        <select
          value={versionId}
          onChange={(e) => setVersionId(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
          required
        >
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              v{v.versionNumber} - {v.changeDescription ?? "No description"}{" "}
              {v.id === currentVersionId ? "(current)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Deadline */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-1">
          Deadline <span className="text-slate-500 font-normal">(optional)</span>
        </label>
        <input
          type="datetime-local"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>

      {/* Workspace mode */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Workspace mode</label>
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="workspaceMode"
              value="STANDARD"
              checked={workspaceMode === "STANDARD"}
              onChange={() => setWorkspaceMode("STANDARD")}
            />
            Standard
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="workspaceMode"
              value="RESTRICTED"
              checked={workspaceMode === "RESTRICTED"}
              onChange={() => setWorkspaceMode("RESTRICTED")}
            />
            Restricted
          </label>
        </div>
        {isRestrictedMode && (
          <p className="mt-2 text-xs text-red-300 bg-red-950/50 border border-red-800 rounded p-2">
            Restricted mode enforces Mandatory + Graded + No Help and enables anti-copy,
            anti-screenshot, and tab/window switch monitoring.
          </p>
        )}
      </div>

      {/* Status */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Assignment type</label>
        <div className="flex gap-6">
          {(["MANDATORY", "PRACTICE"] as const).map((s) => (
            <label key={s} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="distributionStatus"
                value={s}
                checked={effectiveDistributionStatus === s}
                onChange={() => setDistributionStatus(s)}
                disabled={isRestrictedMode}
              />
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </label>
          ))}
        </div>
      </div>

      {/* Graded */}
      <div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={effectiveIsGraded}
            onChange={(e) => setIsGraded(e.target.checked)}
            disabled={isRestrictedMode}
          />
          <span className="font-medium text-slate-300">Graded</span>
        </label>
      </div>

      {/* AI Help Mode */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">AI help mode</label>
        {isMandatoryGraded && !isRestrictedMode && (
          <p className="mb-2 rounded border p-2 text-xs workspace-accent-surface text-[color:var(--color-blue-100)]">
            Mandatory graded assignments only allow <strong>No Help</strong> or{" "}
            <strong>Clarification Only</strong>.
          </p>
        )}
        {isRestrictedMode && (
          <p className="text-xs text-red-300 bg-red-950/50 border border-red-800 rounded p-2 mb-2">
            AI help is locked to <strong>No Help</strong> in restricted mode.
          </p>
        )}
        <div className="space-y-2">
          {ALL_MODES.map((m) => {
            const disabled = isRestrictedMode ? m !== "NO_HELP" : !allowedModes.includes(m);
            return (
              <label
                key={m}
                className={`flex items-start gap-2 text-sm cursor-pointer ${disabled ? "opacity-40" : ""}`}
              >
                <input
                  type="radio"
                  name="aiHelpMode"
                  value={m}
                  checked={effectiveMode === m}
                  onChange={() => setAiHelpMode(m)}
                  disabled={disabled}
                  className="mt-0.5"
                />
                <div>
                  <span className="font-medium">{AI_HELP_MODE_LABELS[m]}</span>
                  <p className="text-slate-400 text-xs">{AI_HELP_MODE_DESCRIPTIONS[m]}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Students */}
      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Students</label>

        {students.length === 0 ? (
          <p className="rounded border p-3 text-sm workspace-accent-surface text-[color:var(--color-blue-100)]">
            No active students available for assignment.
          </p>
        ) : (
          <div className="space-y-3">
            <input
              type="search"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search by name, email, or ID"
              className="w-full border rounded px-3 py-2 text-sm"
            />

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={toggleFilteredStudents}
                className="px-2.5 py-1 border rounded text-slate-300 hover:bg-slate-900/60"
              >
                {allFilteredSelected ? "Clear filtered" : "Select filtered"}
              </button>
              <button
                type="button"
                onClick={() => setSelectedStudentIds([])}
                className="px-2.5 py-1 border rounded text-slate-300 hover:bg-slate-900/60"
              >
                Clear all
              </button>
              <span className="text-slate-400">
                {selectedStudentIds.length} selected
                {studentSearch.trim() ? ` (${filteredSelectedCount} in filter)` : ""}
              </span>
            </div>

            <div className="max-h-72 overflow-y-auto border rounded divide-y">
              {filteredStudents.length === 0 ? (
                <p className="px-3 py-6 text-sm text-slate-400">No students match this search.</p>
              ) : (
                filteredStudents.map((student) => (
                  <label
                    key={student.id}
                    className="flex items-start gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-slate-900/60"
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudentSet.has(student.id)}
                      onChange={() => toggleStudent(student.id)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-slate-100 truncate">{student.name}</p>
                      <p className="text-xs text-slate-400 truncate">{student.email}</p>
                      <p className="text-[11px] text-slate-500 font-mono truncate">{student.id}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading || students.length === 0}
        className="px-5 py-2 bg-green-600 text-white rounded font-medium text-sm hover:bg-green-700 disabled:opacity-50"
      >
        {loading ? "Distributing..." : "Distribute Assignment"}
      </button>
    </form>
  );
}


