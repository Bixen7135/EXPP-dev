import Link from "next/link";
import { resolveSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { listAssignments } from "@/modules/assignments/service";
import { listDistributions } from "@/modules/distribution/service";
import { getStudentAnalytics } from "@/modules/analytics/student";
import {
  ActionCard,
  ActionGrid,
  EmptyState,
  MetricCard,
  MetricGrid,
  PageHero,
  SectionPanel,
  StatusBadge,
  WorkspacePage,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/dashboard/workspace-ui";

type Props = {
  searchParams: Promise<{ teacherId?: string; subject?: string }>;
};

export default async function DashboardWorkspaceHomePage({ searchParams }: Props) {
  const session = await resolveSession();
  if (!session) {
    redirect("/sign-in");
  }
  if (session.domain !== "GLOBAL") {
    redirect("/");
  }

  const sp = await searchParams;
  const teacherId = sp.teacherId && sp.teacherId.trim() ? sp.teacherId : null;
  const subject = sp.subject && sp.subject.trim() ? sp.subject : null;

  const [assignments, distributions, studentAnalytics] = await Promise.all([
    listAssignments(session.id),
    listDistributions(session.id),
    getStudentAnalytics(session.id, {
      teacherId,
      subject,
      period: "all_time",
    }),
  ]);

  const stats = [
    { label: "Created Assignments", value: assignments.length },
    { label: "Distributions", value: distributions.length },
    { label: "Assigned To Me", value: studentAnalytics.overview.totalAssignments },
    { label: "In Progress", value: studentAnalytics.totals.inProgress },
    { label: "Submitted", value: studentAnalytics.overview.submittedCount },
    { label: "Results Available", value: studentAnalytics.overview.publishedCount },
  ];

  const quickActions = [
    {
      href: "/dashboard/materials",
      label: "Materials",
      description: "Manage source materials",
    },
    {
      href: "/dashboard/generate",
      label: "Generate",
      description: "Create a new assignment",
    },
    {
      href: "/dashboard/assignments",
      label: "Assignments",
      description: "Edit versions and distribute",
    },
    {
      href: "/dashboard/banks",
      label: "Banks",
      description: "Reuse tasks and worksheet drafts",
    },
    {
      href: "/dashboard/analytics",
      label: "Analytics",
      description: "Track activity and outcomes",
    },
    {
      href: "/dashboard/my-assignments",
      label: "My Assignments",
      description: "View tasks assigned to you",
    },
  ];

  return (
    <WorkspacePage>
      <PageHero
        title="Workspace"
        actions={<Link href="/dashboard/generate" className={primaryButtonClass()}>Generate assignment</Link>}
      />

      <SectionPanel title="Quick actions" description="The workspace keeps creation and completion paths visually separate but equally available.">
        <ActionGrid>
          {quickActions.map((item) => (
            <ActionCard key={item.href} href={item.href} label={item.label} description={item.description} />
          ))}
        </ActionGrid>
      </SectionPanel>

      <SectionPanel
        title="My learning insights"
        actions={<StatusBadge>{studentAnalytics.recommendationStatus}</StatusBadge>}
      >

        <form className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="block text-xs text-slate-500 mb-1">Teacher</span>
            <select
              name="teacherId"
              defaultValue={teacherId ?? ""}
              className="border rounded px-3 py-2 text-sm min-w-44 bg-slate-950"
            >
              <option value="">All teachers</option>
              {studentAnalytics.teacherBreakdown.map((teacher) => (
                <option key={teacher.teacherId} value={teacher.teacherId}>
                  {teacher.teacherName}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs text-slate-500 mb-1">Subject</span>
            <select
              name="subject"
              defaultValue={studentAnalytics.subjectFilterApplied ?? ""}
              className="border rounded px-3 py-2 text-sm min-w-44 bg-slate-950"
            >
              <option value="">All subjects</option>
              {studentAnalytics.subjectBreakdown.map((entry) => (
                <option key={entry.subjectKey} value={entry.subjectKey}>
                  {entry.subjectLabel}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={primaryButtonClass()}>
            Apply
          </button>
          <Link href="/dashboard" className={secondaryButtonClass()}>
            Clear
          </Link>
        </form>

        {studentAnalytics.recommendation ? (
          <p className="text-sm text-slate-300">{studentAnalytics.recommendation.summary}</p>
        ) : (
          <p className="text-sm text-slate-500">
            Recommendation appears after published results become available.
          </p>
        )}
      </SectionPanel>

      <SectionPanel title="Overview">
        <MetricGrid>
          {stats.map((item) => (
            <MetricCard key={item.label} label={item.label} value={item.value} />
          ))}
        </MetricGrid>
      </SectionPanel>

      <SectionPanel
        title="Recent activity"
        actions={<Link href="/dashboard/my-assignments" className={secondaryButtonClass()}>Open all</Link>}
      >

        {studentAnalytics.assignments.length === 0 ? (
          <EmptyState title="No assigned activity yet" description="Assignments distributed to this account will appear here with the next available action." />
        ) : (
          <ul className="space-y-2">
            {studentAnalytics.assignments.slice(0, 5).map((item) => (
              <li
                key={item.recipientId}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100">{item.assignmentTitle}</p>
                  <p className="mt-1 text-xs text-slate-400">By {item.creatorName}</p>
                </div>
                <Link
                  href={`/dashboard/my-assignments/${item.recipientId}`}
                  className="shrink-0 rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800/80"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>
    </WorkspacePage>
  );
}
