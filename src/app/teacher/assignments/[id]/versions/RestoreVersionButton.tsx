"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  assignmentId: string;
  versionId: string;
  versionNumber: number;
}

export default function RestoreVersionButton({ assignmentId, versionId, versionNumber }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRestore = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/assignments/${assignmentId}/versions/${versionId}/restore`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error ?? "Restore failed");
        return;
      }
      router.refresh();
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="px-3 py-1.5 border rounded text-sm font-medium text-gray-700 hover:bg-gray-50 shrink-0"
      >
        Restore v{versionNumber}
      </button>
    );
  }

  return (
    <div className="flex gap-2 shrink-0">
      <button
        onClick={handleRestore}
        disabled={loading}
        className="px-3 py-1.5 bg-amber-600 text-white rounded text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
      >
        {loading ? "Restoring…" : "Confirm"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="px-3 py-1.5 border rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Cancel
      </button>
    </div>
  );
}
