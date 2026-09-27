import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSession } from "@/lib/auth/session";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { getTeacherAnalytics } from "@/modules/analytics/teacher";
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

const AI_HELP_MODE_LABELS: Record<string, string> = {
  NO_HELP: "No Help",
  CLARIFICATION: "Clarification Only",
  GUIDED: "Guided",
  POST_ASSESSMENT: "Post-Assessment Review",
};

type Props = {
  searchParams: Promise<{ subject?: string }>;
};

export default async function TeacherAnalyticsPage({ searchParams }: Props) {
  const session = await resolveSession();
  if (!session || !canAccessTeacherWorkspace(session)) notFound();

  const sp = await searchParams;
  const analytics = await getTeacherAnalytics(session.id, {
    subject: sp.subject ?? null,
    period: "all_time",
  });

  return (
    <WorkspacePage>
      <PageHero
        title="Analytics"
      />

      <SectionPanel title="Filters">
      <form className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-xs text-slate-500 mb-1">Subject</span>
          <select
            name="subject"
            defaultValue={analytics.activeSubject ?? ""}
            className="border rounded px-3 py-2 text-sm min-w-48 bg-slate-950"
          >
            <option value="">All subjects</option>
            {analytics.subjectOptions.map((subject) => (
              <option key={subject.key} value={subject.key}>
                {subject.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className={primaryButtonClass()}
        >
          Apply
        </button>
        <Link
          href="/dashboard/analytics"
          className={secondaryButtonClass()}
        >
          Clear
        </Link>
      </form>
      </SectionPanel>

      <MetricGrid>
        {[
          { label: "Distributions", value: analytics.totals.distributions },
          { label: "Recipients", value: analytics.totals.recipients },
          { label: "Submitted", value: analytics.totals.submitted },
          { label: "Results Published", value: analytics.totals.publishedResults },
          { label: "AI Help Requests", value: analytics.totals.aiHelpAllowed },
          { label: "AI Blocked", value: analytics.totals.aiHelpBlocked },
        ].map((stat) => (
          <MetricCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </MetricGrid>

      <SectionPanel title="Per-student performance">
        {analytics.students.length === 0 ? (
          <EmptyState title="No student performance data" description="Results will appear here after students submit work matching the selected filter." />
        ) : (
          <ul className="space-y-2">
            {analytics.students.map((student) => (
              <li key={student.learnerAccountId} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-slate-200">{student.learnerName}</p>
                  <StatusBadge>{student.recommendationStatus}</StatusBadge>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                  <Stat label="Avg %" value={student.overview.avgPercent ?? "n/a"} />
                  <Stat label="Published" value={student.overview.publishedCount} />
                  <Stat label="Completion %" value={student.overview.completionRate} />
                  <Stat label="On-time %" value={student.overview.onTimeRate} />
                  <Stat label="Trend Î”" value={student.overview.trendDelta} />
                  <Stat label="AI Help" value={student.overview.aiHelpUsage.total} />
                </div>
                {student.recommendation && (
                  <p className="text-sm text-slate-300">{student.recommendation.summary}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionPanel>

      {analytics.distributions.length === 0 ? (
        <EmptyState
          title="No distributions yet"
          description="Create an assignment and distribute it to start tracking progress."
          action={<Link href="/dashboard/assignments" className={primaryButtonClass()}>Create an assignment</Link>}
        />
      ) : (
        <SectionPanel title="Per-distribution breakdown">
        <div className="space-y-4">
          {analytics.distributions.map((distribution) => {
            const submissionRate =
              distribution.totalRecipients > 0
                ? Math.round((distribution.submitted / distribution.totalRecipients) * 100)
                : 0;

            return (
              <div key={distribution.distributionId} className="border rounded-lg p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{distribution.assignmentTitle}</p>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-1">
                      <span>{distribution.subjectLabel}</span>
                      <span>
                        {distribution.distributionStatus === "MANDATORY"
                          ? "Mandatory"
                          : "Practice"}
                      </span>
                      {distribution.isGraded && (
                        <span className="text-emerald-300 font-medium">Graded</span>
                      )}
                      <span>
                        AI: {AI_HELP_MODE_LABELS[distribution.aiHelpMode] ?? distribution.aiHelpMode}
                      </span>
                      {distribution.deadline && (
                        <span>Due {new Date(distribution.deadline).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-slate-500 shrink-0">
                    {new Date(distribution.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Submission progress</span>
                    <span>
                      {distribution.submitted} / {distribution.totalRecipients} ({submissionRate}%)
                    </span>
                  </div>
                  <div className="h-2 bg-slate-800/70 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{ width: `${submissionRate}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 text-center text-xs">
                  {[
                    { label: "Total", value: distribution.totalRecipients, color: "text-slate-100" },
                    { label: "Not Started", value: distribution.notStarted, color: "text-slate-400" },
                    { label: "Started", value: distribution.started, color: "workspace-themed-link" },
                    { label: "Submitted", value: distribution.submitted, color: "text-green-600" },
                    { label: "AI Allowed", value: distribution.aiHelpAllowed, color: "text-slate-300" },
                    { label: "AI Blocked", value: distribution.aiHelpBlocked, color: "text-red-600" },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className={`font-bold text-lg ${item.color}`}>{item.value}</p>
                      <p className="text-slate-500">{item.label}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <Link
                    href={`/dashboard/distribution/${distribution.distributionId}`}
                    className="text-xs font-semibold workspace-themed-link"
                  >
                    View distribution
                  </Link>
                  {distribution.submitted > 0 && (
                    <Link
                      href={`/dashboard/distribution/${distribution.distributionId}/review`}
                      className="text-xs font-semibold workspace-themed-link"
                    >
                      Review submissions
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </SectionPanel>
      )}
    </WorkspacePage>
  );
}

function Stat(props: { label: string; value: string | number }) {
  return (
    <div className="border rounded p-2 text-center">
      <p className="font-semibold text-sm text-slate-100">{props.value}</p>
      <p className="text-[11px] text-slate-500 mt-1">{props.label}</p>
    </div>
  );
}
