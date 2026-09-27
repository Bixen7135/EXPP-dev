import { resolveSession } from "@/lib/auth/session";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { redirect } from "next/navigation";
import Link from "next/link";
import { listAssignments } from "@/modules/assignments/service";
import { listDistributions } from "@/modules/distribution/service";
import { getTeacherAnalytics } from "@/modules/analytics/teacher";
import {
  ActionCard,
  ActionGrid,
  MetricCard,
  MetricGrid,
  PageHero,
  SectionPanel,
  WorkspacePage,
  primaryButtonClass,
} from "@/components/dashboard/workspace-ui";

export default async function TeacherDashboardPage() {
  const user = await resolveSession();
  if (!user) {
    redirect("/sign-in");
  }
  if (user.domain === "GLOBAL") {
    redirect("/dashboard");
  }
  if (!canAccessTeacherWorkspace(user)) {
    redirect("/sign-in");
  }

  const [assignments, distributions, analytics] = await Promise.all([
    listAssignments(user.id),
    listDistributions(user.id),
    getTeacherAnalytics(user.id, { period: "all_time" }),
  ]);

  const quickActions = [
    { label: "Materials", href: "/teacher/materials", desc: "Manage source materials" },
    { label: "Generate", href: "/teacher/generate", desc: "Create a new assignment" },
    { label: "Assignments", href: "/teacher/assignments", desc: "Edit versions and distribute" },
    { label: "Analytics", href: "/teacher/analytics", desc: "Track activity and outcomes" },
  ];

  const stats = [
    { label: "Created Assignments", value: assignments.length },
    { label: "Distributions", value: distributions.length },
    { label: "Recipients", value: analytics.totals.recipients },
    { label: "Submitted", value: analytics.totals.submitted },
    { label: "Results Published", value: analytics.totals.publishedResults },
    { label: "AI Help Requests", value: analytics.totals.aiHelpAllowed },
  ];

  return (
    <WorkspacePage>
      <PageHero
        title="Teaching command desk"
        actions={<Link href="/teacher/generate" className={primaryButtonClass()}>Generate assignment</Link>}
      />

      <SectionPanel title="Quick actions" description="The core teacher flow stays one click away.">
        <ActionGrid>
          {quickActions.map((item) => (
            <ActionCard key={item.href} href={item.href} label={item.label} description={item.desc} />
          ))}
        </ActionGrid>
      </SectionPanel>

      <SectionPanel title="Overview">
        <MetricGrid>
          {stats.map((item) => (
            <MetricCard key={item.label} label={item.label} value={item.value} />
          ))}
        </MetricGrid>
      </SectionPanel>
    </WorkspacePage>
  );
}
