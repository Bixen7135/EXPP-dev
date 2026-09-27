import { redirect } from "next/navigation";
import Link from "next/link";
import { resolveSession } from "@/lib/auth/session";
import { canAccessStudentWorkspace } from "@/lib/auth/authorization";
import { getStudentAnalytics } from "@/modules/analytics/student";
import {
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

export default async function StudentDashboardPage({ searchParams }: Props) {
  const user = await resolveSession();
  if (!user) {
    redirect("/sign-in");
  }
  if (user.domain === "GLOBAL") {
    redirect("/dashboard");
  }
  if (!canAccessStudentWorkspace(user)) {
    redirect("/sign-in");
  }

  const sp = await searchParams;
  const teacherId = sp.teacherId && sp.teacherId.trim() ? sp.teacherId : null;
  const subject = sp.subject && sp.subject.trim() ? sp.subject : null;

  const analytics = await getStudentAnalytics(user.id, {
    teacherId,
    subject,
    period: "all_time",
  });

  const filteredAssignments = analytics.assignments.filter((assignment) => {
    if (teacherId && assignment.creatorId !== teacherId) return false;
    if (analytics.subjectFilterApplied && assignment.subjectKey !== analytics.subjectFilterApplied) {
      return false;
    }
    return true;
  });

  return (
    <WorkspacePage>
      <PageHero
        title="Learning dashboard"
        actions={<Link href="/student/assignments" className={primaryButtonClass()}>View assignments</Link>}
      />

      <SectionPanel
        title="Learning insights"
        actions={<StatusBadge>{analytics.recommendationStatus}</StatusBadge>}
      >

      <form className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">Teacher</span>
          <select
            name="teacherId"
            defaultValue={teacherId ?? ""}
            className="min-w-44 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">All teachers</option>
            {analytics.teacherBreakdown.map((teacher) => (
              <option key={teacher.teacherId} value={teacher.teacherId}>
                {teacher.teacherName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">Subject</span>
          <select
            name="subject"
            defaultValue={analytics.subjectFilterApplied ?? ""}
            className="min-w-44 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">All subjects</option>
            {analytics.subjectBreakdown.map((item) => (
              <option key={item.subjectKey} value={item.subjectKey}>
                {item.subjectLabel}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={primaryButtonClass()}>
          Apply
        </button>
        <Link href="/student/dashboard" className={secondaryButtonClass()}>
          Clear
        </Link>
      </form>

        {analytics.recommendation ? (
          <div className="space-y-3 text-sm text-slate-300">
            <p>{analytics.recommendation.summary}</p>
            {analytics.recommendation.studyPlan.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-slate-400">
                {analytics.recommendation.studyPlan.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Recommendation will appear after enough published results are available.
          </p>
        )}
      </SectionPanel>

      <MetricGrid>
        {[
          { label: "Assigned", value: analytics.overview.totalAssignments },
          { label: "Submitted", value: analytics.overview.submittedCount },
          { label: "Published", value: analytics.overview.publishedCount },
          { label: "Avg %", value: analytics.overview.avgPercent ?? "n/a" },
        ].map((stat) => (
          <MetricCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </MetricGrid>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionPanel title="By teacher">
          {analytics.teacherBreakdown.length === 0 ? (
            <p className="text-sm text-slate-500">No data yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {analytics.teacherBreakdown.map((item) => (
                <li key={item.teacherId} className="flex justify-between gap-2">
                  <span className="truncate text-slate-300">{item.teacherName}</span>
                  <span className="text-slate-500">
                    {item.overview.avgPercent ?? "n/a"}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>
        <SectionPanel title="By subject">
          {analytics.subjectBreakdown.length === 0 ? (
            <p className="text-sm text-slate-500">No data yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {analytics.subjectBreakdown.map((item) => (
                <li key={item.subjectKey} className="flex justify-between gap-2">
                  <span className="truncate text-slate-300">{item.subjectLabel}</span>
                  <span className="text-slate-500">
                    {item.overview.avgPercent ?? "n/a"}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>
      </div>

      <SectionPanel
        title="Recent activity"
        actions={<Link href="/student/assignments" className={secondaryButtonClass()}>Open all</Link>}
      >
        {filteredAssignments.length === 0 ? (
          <EmptyState title="No recent activity" description="Assigned work matching the current filters will appear here." />
        ) : (
          <ul className="space-y-2">
            {filteredAssignments.slice(0, 5).map((assignment) => (
              <li
                key={assignment.recipientId}
                className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium text-slate-100">{assignment.assignmentTitle}</p>
                  <p className="text-xs text-slate-400">
                    By {assignment.creatorName} - {assignment.subjectLabel}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  {assignment.resultPublished && assignment.grade !== null ? (
                    <span className="text-sm font-semibold text-green-700">
                      {assignment.grade}/{assignment.maxGrade} ({assignment.percentage}%)
                    </span>
                  ) : assignment.recipientStatus === "SUBMITTED" ? (
                    <span className="text-xs text-slate-500">Submitted - awaiting result</span>
                  ) : assignment.recipientStatus === "ACTIVE" ? (
                    <span className="text-xs text-[color:var(--color-blue-200)]">In progress</span>
                  ) : (
                    <span className="text-xs text-slate-500">Not started</span>
                  )}
                  <Link
                    href={`/student/assignments/${assignment.recipientId}`}
                    className="text-xs workspace-themed-link hover:underline"
                  >
                    {assignment.recipientStatus === "SUBMITTED" ? "View" : "Open"}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>
    </WorkspacePage>
  );
}
