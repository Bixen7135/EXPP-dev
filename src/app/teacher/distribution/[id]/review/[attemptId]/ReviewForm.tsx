"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AssessmentDetail } from "@/modules/assessment/types";

interface Props {
  attemptId: string;
  assessment: AssessmentDetail;
  distributionId: string;
}

const AUTO_STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: "bg-gray-100 text-gray-600",
  QUEUED: "bg-amber-100 text-amber-700",
  PROCESSING: "bg-indigo-100 text-indigo-700",
  READY: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
};

export function ReviewForm({ attemptId, assessment, distributionId }: Props) {
  const router = useRouter();
  const [grade, setGrade] = useState<string>(
    assessment.manualGrade !== null
      ? String(assessment.manualGrade)
      : assessment.aiRecommendation
        ? String(assessment.aiRecommendation.recommendedTotal)
        : ""
  );
  const [maxGrade, setMaxGrade] = useState<string>(
    assessment.maxGrade !== null
      ? String(assessment.maxGrade)
      : assessment.aiRecommendation
        ? String(assessment.aiRecommendation.maxTotal)
        : "10"
  );
  const [comment, setComment] = useState(assessment.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState(assessment.status);

  const isPublished = status === "PUBLISHED";

  async function handleReview(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const gradeNum = parseFloat(grade);
    const maxNum = parseFloat(maxGrade);
    if (isNaN(gradeNum) || isNaN(maxNum) || maxNum <= 0 || gradeNum < 0 || gradeNum > maxNum) {
      setError("Grade must be a number between 0 and max grade");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/assessment/${attemptId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualGrade: gradeNum, maxGrade: maxNum, comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to save review");
        return;
      }
      setStatus(data.data.status);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleAnalyze() {
    setError(null);
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/assessment/${attemptId}/analyze`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to queue analysis");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handlePublish() {
    setError(null);
    const confirmed = window.confirm(
      "Publish this result? The student will be able to see their grade and feedback."
    );
    if (!confirmed) return;

    setPublishing(true);
    try {
      const res = await fetch(`/api/assessment/${attemptId}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to publish");
        return;
      }
      setStatus(data.data.status);
      router.push(`/teacher/distribution/${distributionId}/review/${attemptId}`);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium text-blue-900 text-sm">AI Assessment Assistant</h3>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
              AUTO_STATUS_COLORS[assessment.autoCheckStatus] ?? "bg-gray-100 text-gray-600"
            }`}
          >
            {assessment.autoCheckStatus}
          </span>
        </div>

        {assessment.latestAiRun && (
          <p className="text-xs text-blue-700">
            Latest run: {assessment.latestAiRun.status} ({assessment.latestAiRun.trigger})
            {assessment.latestAiRun.confidence ? ` · confidence: ${assessment.latestAiRun.confidence}` : ""}
          </p>
        )}

        {assessment.aiRecommendation ? (
          <div className="space-y-2">
            <p className="text-sm text-blue-800">
              Recommended score: <strong>{assessment.aiRecommendation.recommendedTotal}</strong> /{" "}
              {assessment.aiRecommendation.maxTotal}
              {" "}(confidence: {assessment.aiRecommendation.confidence})
            </p>
            <p className="text-xs text-blue-700">{assessment.aiRecommendation.gradeRationale}</p>
            {assessment.aiRecommendation.warnings.length > 0 && (
              <ul className="list-disc pl-5 space-y-1 text-xs text-amber-700">
                {assessment.aiRecommendation.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
            <div className="space-y-2">
              {assessment.aiRecommendation.items.map((item) => (
                <div key={item.itemOrder} className="rounded border border-blue-100 bg-white p-2">
                  <p className="text-xs font-medium text-gray-800">
                    Q{item.itemOrder}: {item.recommendedScore}/{item.maxScore} · {item.confidence}
                  </p>
                  <p className="text-xs text-gray-700 mt-1">{item.teacherFacingComment}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-blue-700">
            AI recommendation is not ready yet. You can trigger analysis manually.
          </p>
        )}

        {!isPublished && (
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing}
            className="px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {analyzing ? "Queueing..." : "Re-run AI Analysis"}
          </button>
        )}
      </div>

      {assessment.autoCheckResult && (
        <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 space-y-2">
          <h3 className="font-medium text-slate-900 text-sm">Deterministic Auto-check</h3>
          <p className="text-sm text-slate-800">
            Auto-score: <strong>{assessment.autoCheckResult.autoScore} / {assessment.autoCheckResult.autoMaxScore}</strong>
            {" "}(objective items)
          </p>
        </div>
      )}

      {isPublished ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 font-medium text-sm">
            Result published - student can now see their grade and feedback.
          </p>
          <p className="text-green-700 text-sm mt-1">
            Grade: <strong>{assessment.manualGrade} / {assessment.maxGrade}</strong>
          </p>
          {assessment.comment && (
            <p className="text-green-700 text-sm mt-1">Feedback: {assessment.comment}</p>
          )}
        </div>
      ) : (
        <form onSubmit={handleReview} className="space-y-4">
          <h3 className="font-semibold text-gray-900">Teacher Final Review</h3>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                required
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Grade</label>
              <input
                type="number"
                min="1"
                step="0.5"
                value={maxGrade}
                onChange={(e) => setMaxGrade(e.target.value)}
                className="w-full border rounded px-3 py-2 text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Feedback (optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              className="w-full border rounded px-3 py-2 text-sm resize-none"
              placeholder="Leave feedback for the student..."
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Review"}
            </button>
            {status === "REVIEWED" && (
              <button
                type="button"
                onClick={handlePublish}
                disabled={publishing}
                className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {publishing ? "Publishing..." : "Publish Result"}
              </button>
            )}
          </div>

          {status === "REVIEWED" && (
            <p className="text-sm text-gray-500">
              Review saved. Click &quot;Publish Result&quot; to release grades to the student.
            </p>
          )}
        </form>
      )}
    </div>
  );
}
