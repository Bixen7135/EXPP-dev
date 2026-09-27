import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSession } from "@/lib/auth/session";
import { canAccessStudentWorkspace } from "@/lib/auth/authorization";
import { listStudentAssignments } from "@/modules/distribution/service";
import { AI_HELP_MODE_LABELS } from "@/modules/ai-help/mode-definitions";
import {
  EmptyState,
  PageHero,
  SectionPanel,
  StatusBadge,
  WorkspacePage,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/dashboard/workspace-ui";

const ATTEMPT_STATUS_COLORS: Record<string, string> = {
  not_started: "neutral",
  DRAFT: "neutral",
  SUBMITTED: "green",
};

export default async function StudentAssignmentsPage() {
  const session = await resolveSession();
  if (!session || !canAccessStudentWorkspace(session)) notFound();

  const assignments = await listStudentAssignments(session.id);

  return (
    <WorkspacePage maxWidth="max-w-6xl">
      <PageHero
        title="My assignments"
      />

      {assignments.length === 0 ? (
        <EmptyState title="No assignments yet" description="Assignments distributed to you will appear here with due dates, support settings, and the next available action." />
      ) : (
        <SectionPanel title="Assigned work" description={`${assignments.length} assignment${assignments.length === 1 ? "" : "s"} available.`}>
        <ul className="space-y-3">
          {assignments.map((a) => {
            const displayStatus = a.attemptStatus ?? "not_started";
            const statusLabel =
              displayStatus === "not_started"
                ? "Not started"
                : displayStatus === "DRAFT"
                ? "In progress"
                : "Submitted";

            return (
              <li
                key={a.recipientId}
                className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-medium text-slate-100">{a.assignmentTitle}</p>
                  <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                    <span>By {a.creatorName}</span>
                    <span>{a.distributionStatus === "MANDATORY" ? "Mandatory" : "Practice"}</span>
                    {a.isGraded && <span className="text-emerald-300 font-medium">Graded</span>}
                    <span>AI: {AI_HELP_MODE_LABELS[a.aiHelpMode]}</span>
                    {a.deadline && (
                      <span>Due {new Date(a.deadline).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  <span
                    className="hidden"
                  >
                  </span>
                  <StatusBadge tone={(ATTEMPT_STATUS_COLORS[displayStatus] ?? "neutral") as "neutral" | "green"}>{statusLabel}</StatusBadge>
                  <Link
                    href={`/student/assignments/${a.recipientId}`}
                    className={primaryButtonClass()}
                  >
                    {displayStatus === "SUBMITTED" ? "View" : displayStatus === "DRAFT" ? "Continue" : "Start"}
                  </Link>
                  {displayStatus === "SUBMITTED" && (
                    <Link
                      href={`/student/assignments/${a.recipientId}/result`}
                      className={secondaryButtonClass()}
                    >
                      Result
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        </SectionPanel>
      )}
    </WorkspacePage>
  );
}
