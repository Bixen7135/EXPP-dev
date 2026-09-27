import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveSession } from "@/lib/auth/session";
import { listAssignments } from "@/modules/assignments/service";
import type { AssignmentStatus } from "@/modules/assignments/types";
import DeleteAssignmentButton from "./DeleteAssignmentButton";
import {
  EmptyState,
  PageHero,
  SectionPanel,
  StatusBadge,
  WorkspacePage,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/dashboard/workspace-ui";

const STATUS_COLORS: Record<AssignmentStatus, string> = {
  DRAFT: "neutral",
  PUBLISHABLE: "green",
  ASSIGNED: "blue",
};

export default async function AssignmentsPage() {
  const session = await resolveSession();
  if (!session) notFound();

  const assignments = await listAssignments(session.id);

  return (
    <WorkspacePage maxWidth="max-w-6xl">
      <PageHero
        title="Assignments"
        actions={<Link href="/teacher/generate" className={primaryButtonClass()}>New from generation</Link>}
      />

      {assignments.length === 0 ? (
        <EmptyState
          title="No assignments yet"
          description="Generate content first, then return here to edit, version, and distribute it."
          action={<Link href="/teacher/generate" className={primaryButtonClass()}>Generate content</Link>}
        />
      ) : (
        <SectionPanel title="Assignment library" description={`${assignments.length} assignment${assignments.length === 1 ? "" : "s"} available.`}>
        <ul className="space-y-3">
          {assignments.map((a) => (
            <li
              key={a.id}
              className="flex flex-col gap-4 rounded-lg border border-slate-800/85 bg-slate-950/32 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-100">{a.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Created {new Date(a.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <StatusBadge tone={STATUS_COLORS[a.status] as "neutral" | "green" | "blue"}>{a.status}</StatusBadge>
                <Link
                  href={`/teacher/assignments/${a.id}/edit`}
                  className={secondaryButtonClass()}
                >
                  Edit
                </Link>
                <Link
                  href={`/teacher/assignments/${a.id}/versions`}
                  className={secondaryButtonClass()}
                >
                  History
                </Link>
                {(a.status === "PUBLISHABLE" || a.status === "ASSIGNED") && (
                  <Link
                    href={`/teacher/assignments/${a.id}/assign`}
                    className={primaryButtonClass()}
                  >
                    Assign
                  </Link>
                )}
                <DeleteAssignmentButton
                  assignmentId={a.id}
                  assignmentTitle={a.title}
                  disabled={a.status === "ASSIGNED"}
                />
              </div>
            </li>
          ))}
        </ul>
        </SectionPanel>
      )}
    </WorkspacePage>
  );
}
