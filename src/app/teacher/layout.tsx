import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import PlatformPreciseLocationCapture from "@/app/PlatformPreciseLocationCapture";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { resolveSession } from "@/lib/auth/session";

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const session = await resolveSession().catch(() => null);
  if (!session || !canAccessTeacherWorkspace(session)) {
    redirect("/sign-in");
  }
  if (session?.domain === "GLOBAL") {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <h1 className="text-2xl font-semibold text-slate-100">Route moved</h1>
        <p className="text-sm text-slate-300">
          This legacy route is not available in global context. Continue from the unified dashboard
          workspace.
        </p>
        <Link href="/dashboard" className="text-sm font-medium workspace-themed-link hover:text-[color:var(--color-blue-200)]">
          Go to /dashboard
        </Link>
      </main>
    );
  }

  return (
    <>
      <PlatformPreciseLocationCapture />
      <DashboardLayout
        role="teacher"
        username={session.displayName}
        avatarUrl={session.avatarUrl}
        activeAccountId={session.id}
        availableAccounts={session.availableUsers}
      >
        {children}
      </DashboardLayout>
    </>
  );
}
