"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExppBrand } from "@/lib/ui/expp-brand";

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4">
      <g clipPath="url(#google-clip)">
        <path
          d="M8.00018 3.16667C9.18018 3.16667 10.2368 3.57333 11.0702 4.36667L13.3535 2.08333C11.9668 0.793333 10.1568 0 8.00018 0C4.87352 0 2.17018 1.79333 0.853516 4.40667L3.51352 6.47C4.14352 4.57333 5.91352 3.16667 8.00018 3.16667Z"
          fill="#EA4335"
        />
        <path
          d="M15.66 8.18335C15.66 7.66002 15.61 7.15335 15.5333 6.66669H8V9.67335H12.3133C12.12 10.66 11.56 11.5 10.72 12.0667L13.2967 14.0667C14.8 12.6734 15.66 10.6134 15.66 8.18335Z"
          fill="#4285F4"
        />
        <path
          d="M3.51 9.53001C3.35 9.04668 3.25667 8.53334 3.25667 8.00001C3.25667 7.46668 3.34667 6.95334 3.51 6.47001L0.85 4.40668C0.306667 5.48668 0 6.70668 0 8.00001C0 9.29334 0.306667 10.5133 0.853333 11.5933L3.51 9.53001Z"
          fill="#FBBC05"
        />
        <path
          d="M8.0001 16C10.1601 16 11.9768 15.29 13.2968 14.0633L10.7201 12.0633C10.0034 12.5467 9.0801 12.83 8.0001 12.83C5.91343 12.83 4.14343 11.4233 3.5101 9.52667L0.850098 11.59C2.1701 14.2067 4.87343 16 8.0001 16Z"
          fill="#34A853"
        />
      </g>
      <defs>
        <clipPath id="google-clip">
          <rect width="16" height="16" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 1 16 14.5318" fill="none" className="h-4 w-4">
      <path
        d="M8.08803 4.3535C8.74395 4.3535 9.56615 3.91006 10.0558 3.31881C10.4992 2.78299 10.8226 2.03469 10.8226 1.28639C10.8226 1.18477 10.8133 1.08314 10.7948 1C10.065 1.02771 9.18738 1.48963 8.6608 2.10859C8.24508 2.57975 7.86631 3.31881 7.86631 4.07635C7.86631 4.18721 7.88479 4.29807 7.89402 4.33502C7.94021 4.34426 8.01412 4.3535 8.08803 4.3535ZM5.77846 15.5318C6.67457 15.5318 7.07182 14.9313 8.18965 14.9313C9.32596 14.9313 9.57539 15.5133 10.5731 15.5133C11.5524 15.5133 12.2083 14.608 12.8273 13.7211C13.5201 12.7049 13.8065 11.7072 13.825 11.661C13.7603 11.6425 11.885 10.8757 11.885 8.7232C11.885 6.85707 13.3631 6.01639 13.4462 5.95172C12.467 4.5475 10.9796 4.51055 10.5731 4.51055C9.47377 4.51055 8.57766 5.1757 8.01412 5.1757C7.4044 5.1757 6.60066 4.5475 5.64912 4.5475C3.83842 4.5475 2 6.0441 2 8.87101C2 10.6263 2.68363 12.4832 3.52432 13.6842C4.2449 14.7004 4.87311 15.5318 5.77846 15.5318Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function SignUpPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  async function handleResendVerification() {
    const targetEmail = pendingVerificationEmail?.trim() ?? email.trim();
    if (!targetEmail) {
      setResendMessage("Email is required to resend verification.");
      return;
    }

    setResendingVerification(true);
    setResendMessage(null);

    try {
      const response = await fetch("/api/auth/verify-email/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string }
        | null;

      if (!response.ok || payload?.success !== true) {
        setResendMessage(payload?.error ?? "Failed to resend verification email.");
        return;
      }

      setResendMessage(
        "If the email exists and is not verified, a verification link has been sent."
      );
    } catch {
      setResendMessage("Failed to resend verification email.");
    } finally {
      setResendingVerification(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResendMessage(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: username,
          email,
          password,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? "Sign up failed");
        return;
      }

      const pendingVerification = data?.data?.pendingVerification === true;
      const signedUpEmail =
        typeof data?.data?.email === "string" ? data.data.email : email.trim().toLowerCase();

      if (pendingVerification) {
        setPendingVerificationEmail(signedUpEmail);
        setPassword("");
        return;
      }

      router.push("/sign-in?signedUp=1");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
        <div className="w-full space-y-6 border border-slate-800 bg-slate-900 p-6">
          <div className="text-center">
            <div className="flex justify-center">
              <ExppBrand variant="auth" />
            </div>
            <h2 className="mt-2 text-lg text-slate-300">Sign up</h2>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {pendingVerificationEmail ? (
            <div className="space-y-4 rounded-lg border border-blue-500/40 bg-blue-500/10 px-4 py-5 text-sm text-blue-100">
              <p className="text-base font-semibold text-blue-100">Check your email</p>
              <p>
                We sent a verification link to <span className="font-semibold">{pendingVerificationEmail}</span>.
                Confirm your email to activate your account.
              </p>
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendingVerification}
                className="inline-flex items-center justify-center rounded-lg border border-blue-300/40 px-4 py-2 text-sm font-semibold text-blue-100 transition-colors hover:bg-blue-400/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resendingVerification ? "Resending..." : "Resend verification email"}
              </button>
              {resendMessage ? <p className="text-xs text-blue-200">{resendMessage}</p> : null}
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-200">
                    Username
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-200">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-200">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Password should be at least 8 characters including a number and a lowercase letter.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Signing up..." : "Sign up"}
                </button>
              </form>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <span className="h-px flex-1 bg-slate-700" />
                  <span>or</span>
                  <span className="h-px flex-1 bg-slate-700" />
                </div>

                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-base font-medium text-slate-100 transition-colors hover:bg-slate-700"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>

                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-base font-medium text-slate-100 transition-colors hover:bg-slate-700"
                >
                  <AppleIcon />
                  Continue with Apple
                </button>
              </div>
            </>
          )}

          <p className="text-center text-sm text-slate-300">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-blue-400 hover:text-blue-300 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
