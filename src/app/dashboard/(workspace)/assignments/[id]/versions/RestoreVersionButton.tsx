"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { primaryButtonClass, secondaryButtonClass } from "@/components/dashboard/workspace-ui";

interface Props {
  assignmentId: string;
  versionId: string;
  versionNumber: number;
}

export default function RestoreVersionButton({ assignmentId, versionId, versionNumber }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRestore = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/assignments/${assignmentId}/versions/${versionId}/restore`,
        { method: "POST" }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Restore failed");
        return;
      }
      router.refresh();
      setConfirming(false);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={secondaryButtonClass()}>
        Restore v{versionNumber}
      </button>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <div className="flex gap-2">
        <button type="button" onClick={handleRestore} disabled={loading} className={primaryButtonClass()}>
          {loading ? "Restoring..." : "Confirm"}
        </button>
        <button type="button" onClick={() => setConfirming(false)} disabled={loading} className={secondaryButtonClass()}>
          Cancel
        </button>
      </div>
      {error ? <p className="text-right text-xs text-red-300" aria-live="polite">{error}</p> : null}
    </div>
  );
}
