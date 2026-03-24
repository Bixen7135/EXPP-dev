"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  generationResultId: string;
}

export default function CreateAssignmentButton({ generationResultId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ generationResultId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to create assignment");
        return;
      }
      router.push(`/teacher/assignments/${data.data.id}/edit`);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={handleCreate}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? "Creating…" : "Edit & Version"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
