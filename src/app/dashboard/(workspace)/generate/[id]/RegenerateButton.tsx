"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmActionButton } from "@/components/dashboard/ConfirmActionButton";
import { secondaryButtonClass } from "@/components/dashboard/workspace-ui";

export default function RegenerateButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegenerate() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/generation/${requestId}/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <ConfirmActionButton
        onConfirm={handleRegenerate}
        disabled={loading}
        loading={loading}
        className={secondaryButtonClass()}
        message="Replace the current result?"
        confirmLabel="Regenerate"
      >
        {loading ? "Regenerating..." : "Regenerate"}
      </ConfirmActionButton>
      {error ? <p className="mt-1 text-xs text-red-300" aria-live="polite">{error}</p> : null}
    </div>
  );
}
