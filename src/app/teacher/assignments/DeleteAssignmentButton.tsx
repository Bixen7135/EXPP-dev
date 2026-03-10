"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  assignmentId: string;
  assignmentTitle: string;
  disabled?: boolean;
};

export default function DeleteAssignmentButton({
  assignmentId,
  assignmentTitle,
  disabled = false,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    const ok = confirm(`Delete assignment "${assignmentTitle}"? This action cannot be undone.`);
    if (!ok) return;

    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Delete failed");
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={handleDelete}
        disabled={loading || disabled}
        className="px-3 py-1.5 border border-red-200 text-red-600 rounded text-sm font-medium hover:bg-red-50 disabled:opacity-40"
        title={disabled ? "Assigned assignments cannot be deleted" : undefined}
      >
        {loading ? "Deleting..." : "Delete"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
