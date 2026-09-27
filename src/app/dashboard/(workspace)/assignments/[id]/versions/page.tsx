import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSession } from "@/lib/auth/session";
import { getAssignment } from "@/modules/assignments/service";
import { ForbiddenError, NotFoundError } from "@/lib/errors";
import RestoreVersionButton from "./RestoreVersionButton";

type Props = { params: Promise<{ id: string }> };

export default async function AssignmentVersionsPage({ params }: Props) {
  const { id } = await params;
  const session = await resolveSession();
  if (!session) notFound();

  let assignment;
  try {
    assignment = await getAssignment(id, session.id);
  } catch (err) {
    if (err instanceof NotFoundError || err instanceof ForbiddenError) notFound();
    throw err;
  }

  const canRestore = assignment.status !== "ASSIGNED";

  return (
    <main className="p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2 mb-1">
        <Link href="/dashboard/assignments" className="text-sm text-slate-400 hover:underline">
          Assignments
        </Link>
        <span className="text-slate-500">/</span>
        <Link
          href={`/dashboard/assignments/${id}/edit`}
          className="text-sm text-slate-400 hover:underline truncate max-w-xs"
        >
          {assignment.title}
        </Link>
        <span className="text-slate-500">/</span>
        <span className="text-sm text-slate-300">Version History</span>
      </div>

      <h1 className="text-2xl font-bold">Version History</h1>

      {assignment.versions.length === 0 ? (
        <p className="text-slate-400">No versions yet.</p>
      ) : (
        <ul className="space-y-3">
          {assignment.versions.map((v) => {
            const isCurrent = v.id === assignment.currentVersionId;
            return (
              <li
                key={v.id}
                className={`p-4 border rounded-lg flex items-start justify-between gap-4 ${isCurrent ? "border-[color:var(--color-blue-300)] bg-[color:var(--color-blue-500)]/10" : ""}`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">v{v.versionNumber}</span>
                    {isCurrent && (
                      <span className="text-xs px-2 py-0.5 bg-[color:var(--color-blue-500)]/12 text-[color:var(--color-blue-200)] rounded-full font-medium">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {v.changeDescription ?? "No description"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(v.createdAt).toLocaleString()}
                  </p>
                </div>
                {!isCurrent && canRestore && (
                  <RestoreVersionButton assignmentId={id} versionId={v.id} versionNumber={v.versionNumber} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}



