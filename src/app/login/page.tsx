"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

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

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") ?? "/";
  const intent = searchParams.get("intent");
  const title = intent === "add-account" ? "Add an account" : "Sign in";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!data.success) {
        setError(data.error ?? "Login failed");
        return;
      }

      const dest = from !== "/" ? from : "/";
      router.push(dest);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
        <div className="w-full space-y-6 overflow-hidden rounded-lg border border-slate-800 bg-slate-900 p-8 shadow-[0_24px_50px_rgba(2,6,23,0.55)]">
          <style>{`
            .expp-brand {
              display: inline-flex;
              align-items: center;
              gap: 12px;
              text-decoration: none;
              transition: transform 0.2s ease;
            }

            .expp-brand:hover {
              transform: scale(1.05);
            }

            .expp-brand__icon-box {
              width: 48px;
              height: 48px;
              border-radius: 14px;
              background: #2563eb;
              display: flex;
              align-items: center;
              justify-content: center;
              flex: 0 0 48px;
            }

            .expp-brand__icon {
              width: 30px;
              height: 30px;
              color: #ffffff;
            }

            .expp-brand__text {
              font-size: 32px;
              font-weight: 700;
              line-height: 1;
              letter-spacing: 0.5px;
              background: linear-gradient(90deg, #2563eb 0%, #60a5fa 100%);
              -webkit-background-clip: text;
              background-clip: text;
              color: transparent;
            }

            @media (max-width: 640px) {
              .expp-brand__text {
                display: none;
              }

              .expp-brand__icon-box {
                width: 40px;
                height: 40px;
                border-radius: 12px;
                flex-basis: 40px;
              }

              .expp-brand__icon {
                width: 24px;
                height: 24px;
              }
            }
          `}</style>

          <div className="text-center">
            <div className="flex justify-center">
              <div className="expp-brand" aria-label="EXPP">
                <div className="expp-brand__icon-box">
                  <svg
                    className="expp-brand__icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M22 10v6" />
                    <path d="M2 10l10-5 10 5-10 5Z" />
                    <path d="M6 12v5c3 3 9 3 12 0v-5" />
                  </svg>
                </div>

                <span className="expp-brand__text">EXPP</span>
              </div>
            </div>
            <h2 className="mt-2 text-lg text-slate-300">{title}</h2>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                className="mt-1 block w-full rounded-lg border bg-[#374359] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ borderColor: "#3f5578" }}
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-lg border bg-[#374359] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{ borderColor: "#3f5578" }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
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
              style={{ borderColor: "#3f5578" }}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <button
              type="button"
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-base font-medium text-slate-100 transition-colors hover:bg-slate-700"
              style={{ borderColor: "#3f5578" }}
            >
              <AppleIcon />
              Continue with Apple
            </button>
          </div>

          <p className="text-center text-sm text-slate-300">
            New here?{" "}
            <Link href="/register" className="font-medium text-blue-400 hover:text-blue-300 hover:underline">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
