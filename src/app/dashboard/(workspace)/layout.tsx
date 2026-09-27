import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/auth/session";
import { DashboardShell } from "../DashboardShell";

export default async function DashboardWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await resolveSession();
  if (!session) {
    redirect("/sign-in");
  }
  if (session.domain !== "GLOBAL") {
    redirect("/");
  }

  return (
    <DashboardShell
      username={session.name}
      avatarUrl={session.avatarUrl}
      activeAccountId={session.id}
      availableAccounts={session.availableUsers}
    >
      {children}
    </DashboardShell>
  );
}
