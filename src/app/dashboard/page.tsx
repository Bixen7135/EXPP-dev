import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/auth/session";
import { DashboardShell } from "./DashboardShell";

export default async function DashboardPage() {
  const session = await resolveSession();
  if (!session) {
    redirect("/login");
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
    />
  );
}
