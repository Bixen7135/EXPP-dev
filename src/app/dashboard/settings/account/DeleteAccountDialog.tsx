"use client";

import { useEffect, useMemo, useState } from "react";

const CONFIRM_PHRASE = "delete my account";

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

function WarningIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[24px] w-[24px]">
      <path
        d="M12 3.8 21 19a1.4 1.4 0 0 1-1.2 2.1H4.2A1.4 1.4 0 0 1 3 19L12 3.8Z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path d="M12 9v5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
      <circle cx="12" cy="17.5" r="1" fill="currentColor" />
    </svg>
  );
}

interface DeleteAccountDialogProps {
  username: string;
  email: string;
}

export function DeleteAccountDialog({ username, email }: DeleteAccountDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [attempted, setAttempted] = useState(false);

  const allowedIdentifiers = useMemo(() => {
    return [username, email]
      .map((value) => value.trim().toLowerCase())
      .filter((value): value is string => value.length > 0);
  }, [username, email]);

  const isIdentifierValid = allowedIdentifiers.includes(identifier.trim().toLowerCase());
  const isPhraseValid = confirmation.trim() === CONFIRM_PHRASE;
  const canSubmit = isIdentifierValid && isPhraseValid;

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
    setIdentifier("");
    setConfirmation("");
    setAttempted(false);
    setIsOpen(true);
  }

  function closeDialog() {
    setIsOpen(false);
  }

  function handleConfirmDeletion() {
    setAttempted(true);
    if (!canSubmit) return;
    setIsOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="mt-[14px] inline-flex items-center justify-center rounded-[10px] border border-red-500/50 bg-slate-800/75 px-[16px] py-[5px] text-[14px] font-medium text-red-400 transition-colors hover:bg-red-900/25"
      >
        Delete your account
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6"
          onClick={closeDialog}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="relative w-full max-w-[760px] rounded-[22px] border border-slate-700 bg-slate-950 p-5 shadow-[0_24px_50px_rgba(2,6,23,0.7)] sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeDialog}
              aria-label="Close delete account dialog"
              className="absolute right-5 top-5 inline-flex h-[48px] w-[48px] items-center justify-center rounded-[12px] border border-slate-700 bg-slate-900/70 text-slate-200 transition-colors hover:bg-slate-800"
            >
              <CloseIcon />
            </button>

            <h3 id="delete-account-title" className="pr-[64px] text-[24px] font-semibold leading-[1.15] text-slate-100 sm:text-[28px]">
              Are you sure you want to do this?
            </h3>

            <div className="mt-6 flex items-center gap-4 border border-red-500/50 bg-red-950/30 px-5 py-6">
              <span className="text-red-400">
                <WarningIcon />
              </span>
              <p className="text-[18px] font-medium leading-none text-slate-100 sm:text-[20px]">
                This is extremely important.
              </p>
            </div>

            <div className="space-y-5 pt-7 text-[16px] leading-[1.6] text-slate-100 sm:text-[17px]">
              <p>
                We will <span className="font-semibold">immediately delete your EXPP account data</span>, including
                your profile, settings, active sessions, and access to platform activity.
              </p>
              <p>
                This action is irreversible. Once deletion is completed, your account cannot be restored from the
                dashboard.
              </p>
            </div>

            <div className="mt-7 border-t border-slate-800 pt-7">
              <label htmlFor="delete-account-identifier" className="block text-[17px] font-semibold text-slate-100">
                Your username or email:
              </label>
              <input
                id="delete-account-identifier"
                value={identifier}
                onChange={(event) => setIdentifier(event.target.value)}
                className="mt-3 h-[48px] w-full rounded-[12px] border border-slate-700 bg-slate-900/70 px-4 text-[16px] text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-slate-500"
                placeholder="Enter username or email"
              />
              {attempted && !isIdentifierValid ? (
                <p className="pt-2 text-[13px] text-red-300">Enter your current username or account email.</p>
              ) : null}

              <label
                htmlFor="delete-account-confirmation"
                className="block pt-6 text-[17px] font-semibold leading-[1.5] text-slate-100"
              >
                To verify, type{" "}
                <span
                  className="italic select-none"
                  onCopy={(event) => event.preventDefault()}
                  onCut={(event) => event.preventDefault()}
                >
                  {CONFIRM_PHRASE}
                </span>{" "}
                exactly as it appears:
              </label>
              <input
                id="delete-account-confirmation"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-3 h-[48px] w-full rounded-[12px] border border-slate-700 bg-slate-900/70 px-4 text-[16px] text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-slate-500"
                placeholder={CONFIRM_PHRASE}
              />
              {attempted && !isPhraseValid ? (
                <p className="pt-2 text-[13px] text-red-300">Type the confirmation phrase exactly.</p>
              ) : null}

              <p className="pt-5 text-[15px] text-slate-400">
                You&apos;ll be prompted to verify your identity before account deletion.
              </p>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <button
                  type="button"
                  onClick={closeDialog}
                  className="inline-flex h-[48px] items-center justify-center rounded-[12px] border border-slate-700 bg-slate-900/70 px-6 text-[15px] font-medium text-slate-200 transition-colors hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeletion}
                  className="inline-flex h-[48px] items-center justify-center rounded-[12px] border border-slate-700 bg-slate-900/70 px-7 text-[15px] font-medium text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900/70 disabled:text-slate-200 disabled:hover:bg-slate-900/70"
                  disabled={!canSubmit}
                >
                  Permanently delete EXPP account
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
