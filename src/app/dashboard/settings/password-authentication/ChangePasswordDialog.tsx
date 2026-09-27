"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[20px] w-[20px]">
      <path
        d="M7 7l10 10M17 7L7 17"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function isPasswordStrong(password: string): boolean {
  return password.length >= 8 && /[a-z]/.test(password) && /\d/.test(password);
}

const PASSWORD_HINT =
  "Password should be at least 8 characters including a number and a lowercase letter.";

export function ChangePasswordDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const validation = useMemo(() => {
    const hasOldPassword = oldPassword.trim().length > 0;
    const hasNewPassword = newPassword.trim().length > 0;
    const hasConfirmPassword = confirmPassword.trim().length > 0;
    const strongPassword = isPasswordStrong(newPassword);
    const matchingConfirmation = newPassword === confirmPassword;
    const canSubmit =
      hasOldPassword &&
      hasNewPassword &&
      hasConfirmPassword &&
      strongPassword &&
      matchingConfirmation;

    return {
      hasOldPassword,
      hasNewPassword,
      hasConfirmPassword,
      strongPassword,
      matchingConfirmation,
      canSubmit,
    };
  }, [oldPassword, newPassword, confirmPassword]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  function openDialog() {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setAttempted(false);
    setSubmitError(null);
    setSuccessMessage(null);
    setIsSubmitting(false);
    setIsOpen(true);
  }

  function closeDialog() {
    if (isSubmitting) return;
    setIsOpen(false);
  }

  async function handleChangePassword() {
    setAttempted(true);
    if (!validation.canSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch("/api/auth/password/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (!response.ok || payload?.success !== true) {
        setSubmitError(payload?.error ?? "Failed to update password. Please try again.");
        return;
      }

      setIsOpen(false);
      setSuccessMessage("Password updated successfully.");
    } catch {
      setSubmitError("Failed to update password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-start gap-2 sm:ml-auto">
        <button
          type="button"
          onClick={openDialog}
          className="inline-flex h-[50px] w-[90px] items-center justify-center rounded-[16px] border border-slate-600/90 bg-slate-800/70 px-[26px] text-[14px] font-medium leading-none text-slate-100 transition-colors hover:bg-slate-700/75"
        >
          Change
        </button>
        {successMessage ? <p className="text-[12px] text-emerald-400">{successMessage}</p> : null}
      </div>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6"
          onClick={closeDialog}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="change-password-title"
            className="relative w-full max-w-[760px] rounded-[22px] border border-slate-700 bg-slate-950 p-5 shadow-[0_24px_50px_rgba(2,6,23,0.7)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeDialog}
              aria-label="Close change password dialog"
              className="absolute right-5 top-5 inline-flex h-[48px] w-[48px] items-center justify-center rounded-[12px] border border-slate-700 bg-slate-900/70 text-slate-200 transition-colors hover:bg-slate-800"
            >
              <CloseIcon />
            </button>

            <h3
              id="change-password-title"
              className="pr-[64px] text-[24px] font-semibold leading-[1.15] text-slate-100 sm:text-[28px]"
            >
              Change password
            </h3>

            <div className="mt-7 border-t border-slate-800 pt-7">
              <label htmlFor="old-password" className="block text-[17px] font-semibold text-slate-100">
                Old password
              </label>
              <input
                id="old-password"
                type="password"
                value={oldPassword}
                onChange={(event) => setOldPassword(event.target.value)}
                className="mt-3 h-[48px] w-full rounded-[12px] border border-slate-700 bg-slate-900/70 px-4 text-[16px] text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-slate-500"
                autoComplete="current-password"
              />
              {attempted && !validation.hasOldPassword ? (
                <p className="pt-2 text-[13px] text-red-300">Enter your current password.</p>
              ) : null}

              <label htmlFor="new-password" className="block pt-6 text-[17px] font-semibold text-slate-100">
                New password
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="mt-3 h-[48px] w-full rounded-[12px] border border-slate-700 bg-slate-900/70 px-4 text-[16px] text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-slate-500"
                autoComplete="new-password"
              />

              <label
                htmlFor="confirm-new-password"
                className="block pt-6 text-[17px] font-semibold text-slate-100"
              >
                Confirm new password
              </label>
              <input
                id="confirm-new-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="mt-3 h-[48px] w-full rounded-[12px] border border-slate-700 bg-slate-900/70 px-4 text-[16px] text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-slate-500"
                autoComplete="new-password"
              />

              <p className="pt-5 text-[15px] text-slate-300">{PASSWORD_HINT}</p>
              {attempted && !validation.strongPassword ? (
                <p className="pt-2 text-[13px] text-red-300">{PASSWORD_HINT}</p>
              ) : null}
              {attempted && !validation.matchingConfirmation ? (
                <p className="pt-2 text-[13px] text-red-300">Passwords do not match.</p>
              ) : null}

              <div className="pt-4">
                <Link href="/sign-in" className="text-[15px] text-blue-400 transition-colors hover:text-blue-300">
                  I forgot my password
                </Link>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={isSubmitting}
                  className="inline-flex h-[48px] items-center justify-center rounded-[12px] border border-slate-700 bg-slate-900/70 px-6 text-[15px] font-medium text-slate-200 transition-colors hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={!validation.canSubmit || isSubmitting}
                  className="inline-flex h-[48px] items-center justify-center rounded-[12px] border border-slate-700 bg-slate-900/70 px-7 text-[15px] font-medium text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Updating..." : "Update password"}
                </button>
              </div>

              {submitError ? <p className="pt-3 text-[13px] text-red-300">{submitError}</p> : null}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
