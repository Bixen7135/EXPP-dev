import { resolveSession } from "@/lib/auth/session";
import { canAccessAdminWorkspace } from "@/lib/auth/authorization";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import {
  ActionCard,
  ActionGrid,
  MetricCard,
  MetricGrid,
  PageHero,
  SectionPanel,
  WorkspacePage,
} from "@/components/dashboard/workspace-ui";

export default async function AdminDashboardPage() {
  const user = await resolveSession();
  if (!user || !canAccessAdminWorkspace(user)) {
    redirect("/sign-in");
  }

  const [userCount, auditCount] = await Promise.all([
    prisma.user.count(),
    prisma.auditEvent.count(),
  ]);

  return (
    <WorkspacePage maxWidth="max-w-5xl">
      <PageHero
        title="Admin dashboard"
      />

      <MetricGrid>
        <MetricCard label="Total users" value={userCount} />
        <MetricCard label="Audit events" value={auditCount} />
      </MetricGrid>

      <SectionPanel
        title="Admin actions"
        description="Keep high-impact controls visible without changing admin-only access."
      >
        <ActionGrid>
          <ActionCard href="/admin/users" label="Manage users" description="Review accounts, roles, and access." />
          <ActionCard href="/admin/audit" label="View audit log" description="Trace platform events and account activity." />
        </ActionGrid>
      </SectionPanel>
    </WorkspacePage>
  );
}
