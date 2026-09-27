import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSession } from "@/lib/auth/session";
import { getDistribution } from "@/modules/distribution/service";
import { ForbiddenError } from "@/lib/errors";
import { AI_HELP_MODE_LABELS } from "@/modules/ai-help/mode-definitions";
import { prisma } from "@/lib/db/prisma";

type Props = { params: Promise<{ id: string }> };

const RECIPIENT_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-600",
  ACTIVE: "bg-[color:var(--color-blue-500)]/12 text-[color:var(--color-blue-200)]",
  SUBMITTED: "bg-green-100 text-green-700",
};

const RESTRICTED_EVENT_LABELS: Record<string, string> = {
  "attempt.restricted.copy_blocked": "Copy blocked",
  "attempt.restricted.screenshot_attempt": "Screenshot attempt",
  "attempt.restricted.tab_switch": "Tab switch",
  "attempt.restricted.window_blur": "Window switch",
};

function describeRestrictedEvent(action: string, context: unknown): string {
  const base = RESTRICTED_EVENT_LABELS[action] ?? action;
  if (!context || typeof context !== "object" || Array.isArray(context)) return base;

  const rawMeta = (context as Record<string, unknown>).meta;
  if (!rawMeta || typeof rawMeta !== "object" || Array.isArray(rawMeta)) return base;

  const meta = rawMeta as Record<string, unknown>;
  if (typeof meta.channel === "string") return `${base} (${meta.channel})`;
  if (typeof meta.key === "string") return `${base} (${meta.key})`;
  return base;
}

export default async function DistributionDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await resolveSession();
  if (!session) notFound();

  let distribution;
  try {
    distribution = await getDistribution(id, session.id);
  } catch (err) {
    if (err instanceof ForbiddenError) notFound();
    notFound();
  }

  const submittedCount = distribution.recipients.filter((r) => r.status === "SUBMITTED").length;
  const activeCount = distribution.recipients.filter((r) => r.status === "ACTIVE").length;
  const isRestrictedMode =
    distribution.status === "MANDATORY" &&
    distribution.isGraded &&
    distribution.aiHelpMode === "NO_HELP";

  const recipientIds = isRestrictedMode
    ? distribution.recipients.map((recipient) => recipient.id)
    : [];
  const attempts =
    recipientIds.length > 0
      ? await prisma.attempt.findMany({
          where: { recipientId: { in: recipientIds } },
          select: { id: true, recipientId: true },
        })
      : [];

  const attemptRecipientById = new Map(attempts.map((attempt) => [attempt.id, attempt.recipientId]));
  const recipientNameById = new Map(
    distribution.recipients.map((recipient) => [recipient.id, recipient.recipientDisplayName])
  );

  const restrictedEventsRaw =
    attempts.length > 0
      ? await prisma.auditEvent.findMany({
          where: {
            entityType: "Attempt",
            entityId: { in: attempts.map((attempt) => attempt.id) },
            action: { startsWith: "attempt.restricted." },
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : [];

  const restrictedEvents = restrictedEventsRaw.map((event) => {
    const recipientId = event.entityId ? attemptRecipientById.get(event.entityId) : undefined;
    return {
      id: event.id,
      actionLabel: describeRestrictedEvent(event.action, event.context),
      createdAt: event.createdAt,
      recipientDisplayName: recipientId ? recipientNameById.get(recipientId) ?? "Unknown student" : "Unknown student",
    };
  });

  return (
    <main className="p-8 max-w-3xl mx-auto space-y-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/teacher/assignments" className="hover:text-gray-700">
          Assignments
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Distribution</span>
      </nav>

      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{distribution.assignmentTitle}</h1>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span>
            Type: <strong>{distribution.status}</strong>
          </span>
          <span>
            Graded: <strong>{distribution.isGraded ? "Yes" : "No"}</strong>
          </span>
          <span>
            AI Help: <strong>{AI_HELP_MODE_LABELS[distribution.aiHelpMode]}</strong>
          </span>
          {isRestrictedMode && (
            <span className="text-red-600">
              Mode: <strong>Restricted</strong>
            </span>
          )}
          {distribution.deadline && (
            <span>
              Deadline: <strong>{new Date(distribution.deadline).toLocaleString()}</strong>
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-6 text-sm text-gray-600">
          <span>
            Total recipients: <strong>{distribution.recipients.length}</strong>
          </span>
          <span>
            Active: <strong>{activeCount}</strong>
          </span>
          <span>
            Submitted: <strong>{submittedCount}</strong>
          </span>
        </div>
        {submittedCount > 0 && (
          <Link
            href={`/teacher/distribution/${distribution.id}/review`}
            className="px-4 py-2 workspace-primary-action text-white rounded text-sm font-medium "
          >
            Review Submissions
          </Link>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Recipients</h2>
        {distribution.recipients.length === 0 ? (
          <p className="text-gray-500 text-sm">No recipients.</p>
        ) : (
          <ul className="space-y-2">
            {distribution.recipients.map((r) => (
              <li key={r.id} className="border rounded p-3 flex items-center justify-between">
                <span className="text-sm font-mono text-gray-700">{r.recipientDisplayName}</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    RECIPIENT_STATUS_COLORS[r.status] ?? "bg-gray-100"
                  }`}
                >
                  {r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {isRestrictedMode && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Restricted Activity</h2>
          {restrictedEvents.length === 0 ? (
            <p className="text-gray-500 text-sm">No restricted-mode events recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {restrictedEvents.map((event) => (
                <li key={event.id} className="border rounded p-3 space-y-1">
                  <p className="text-sm font-medium text-gray-900">{event.recipientDisplayName}</p>
                  <p className="text-sm text-gray-700">{event.actionLabel}</p>
                  <p className="text-xs text-gray-500">{event.createdAt.toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
