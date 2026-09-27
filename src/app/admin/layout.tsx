import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import PlatformPreciseLocationCapture from "@/app/PlatformPreciseLocationCapture";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { canAccessAdminWorkspace } from "@/lib/auth/authorization";
import { resolveSession } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await resolveSession();
  if (!session || !canAccessAdminWorkspace(session)) {
    redirect("/sign-in");
  }

  return (
    <>
      <PlatformPreciseLocationCapture />
      <DashboardLayout
        role="admin"
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
