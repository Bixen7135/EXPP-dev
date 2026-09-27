"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmActionButton } from "@/components/dashboard/ConfirmActionButton";
import { dangerButtonClass } from "@/components/dashboard/workspace-ui";

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
      <ConfirmActionButton
        onConfirm={handleDelete}
        disabled={loading || disabled}
        loading={loading}
        className={dangerButtonClass()}
        message={`Delete "${assignmentTitle}"?`}
        confirmLabel="Delete"
      >
        {disabled ? "Locked" : loading ? "Deleting..." : "Delete"}
      </ConfirmActionButton>
      {disabled ? <p className="mt-1 text-right text-xs text-slate-500">Assigned work is locked.</p> : null}
      {error && <p className="mt-1 text-right text-xs text-red-300" aria-live="polite">{error}</p>}
    </div>
  );
}
