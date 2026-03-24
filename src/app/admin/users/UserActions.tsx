"use client";

import { useState } from "react";
import type { UserSummary } from "@/modules/admin/service";

interface Props {
  user: UserSummary;
  currentUserId: string;
}

export default function UserActions({ user, currentUserId }: Props) {
  const [isActive, setIsActive] = useState(user.isActive);
  const [loading, setLoading] = useState(false);

  const isSelf = user.id === currentUserId;

  async function toggleActive() {
    if (isSelf) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (res.ok) {
        const json = await res.json();
        setIsActive(json.data.isActive);
      } else {
        const json = await res.json();
        alert(json.error ?? "Failed to update user");
      }
    } finally {
      setLoading(false);
    }
  }

  if (isSelf) {
    return <span className="text-xs text-gray-400">You</span>;
  }

  return (
    <button
      onClick={toggleActive}
      disabled={loading}
      className={`px-3 py-1.5 rounded text-sm font-medium border ${
        isActive
          ? "text-red-700 border-red-200 hover:bg-red-50"
          : "text-green-700 border-green-200 hover:bg-green-50"
      } disabled:opacity-50`}
    >
      {loading ? "..." : isActive ? "Deactivate" : "Reactivate"}
    </button>
  );
}
