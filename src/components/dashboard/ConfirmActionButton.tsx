"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export function ConfirmActionButton({
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  message,
  disabled,
  loading,
  className,
  onConfirm,
}: {
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  message: string;
  disabled?: boolean;
  loading?: boolean;
  className: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-950/70 p-2">
        <span className="max-w-44 text-xs leading-5 text-slate-300">{message}</span>
        <button
          type="button"
          disabled={loading}
          onClick={async () => {
            await onConfirm();
            setConfirming(false);
          }}
          className="rounded bg-red-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300 disabled:opacity-50"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => setConfirming(false)}
          className="rounded border border-slate-700 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-blue-400)] disabled:opacity-50"
        >
          {cancelLabel}
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      disabled={disabled || loading}
      className={className}
    >
      {children}
    </button>
  );
}
