"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegenerateButton({
  requestId,
}: {
  requestId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegenerate() {
    if (!confirm("Regenerate this assignment? The current result will be replaced."))
      return;

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
      <button
        onClick={handleRegenerate}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium disabled:opacity-50"
      >
        {loading ? "Regenerating…" : "Regenerate"}
      </button>
      {error && <p className="text-red-600 text-xs mt-1">{error}</p>}
    </div>
  );
}
