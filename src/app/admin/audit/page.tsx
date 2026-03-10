import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSession } from "@/lib/auth/session";
import { getAuditLog } from "@/modules/admin/service";

type Props = {
  searchParams: Promise<{
    action?: string;
    userId?: string;
    entityType?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
};

export default async function AdminAuditPage({ searchParams }: Props) {
  const session = await resolveSession();
  if (!session || session.role !== "ADMIN") notFound();

  const sp = await searchParams;
  const page = sp.page ? parseInt(sp.page, 10) : 1;

  const result = await getAuditLog("ADMIN", session.id, {
    action: sp.action,
    userId: sp.userId,
    entityType: sp.entityType,
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to) : undefined,
    page,
    pageSize: 50,
  });

  const totalPages = Math.ceil(result.total / result.pageSize);

  return (
    <main className="p-8 max-w-6xl mx-auto space-y-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="hover:text-gray-700">Admin</Link>
        <span>/</span>
        <span className="text-gray-900">Audit Log</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <span className="text-sm text-gray-500">{result.total} events</span>
      </div>

      {/* Filter form */}
      <form className="flex flex-wrap gap-3 items-end border rounded-lg p-4 bg-gray-50">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">Action</label>
          <input
            name="action"
            defaultValue={sp.action ?? ""}
            placeholder="e.g. auth.login"
            className="px-2 py-1 border rounded text-sm w-44"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">User ID</label>
          <input
            name="userId"
            defaultValue={sp.userId ?? ""}
            placeholder="User ID"
            className="px-2 py-1 border rounded text-sm w-44"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">From</label>
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className="px-2 py-1 border rounded text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">To</label>
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ""}
            className="px-2 py-1 border rounded text-sm"
          />
        </div>
        <button
          type="submit"
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
        >
          Filter
        </button>
        <Link href="/admin/audit" className="px-3 py-1.5 border rounded text-sm text-gray-700 hover:bg-gray-50">
          Clear
        </Link>
      </form>

      {result.entries.length === 0 ? (
        <div className="border rounded-lg p-10 text-center text-gray-500">
          <p>No audit events found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b text-left text-xs text-gray-500">
                <th className="pb-2 pr-4 font-medium">Time</th>
                <th className="pb-2 pr-4 font-medium">User</th>
                <th className="pb-2 pr-4 font-medium">Action</th>
                <th className="pb-2 pr-4 font-medium">Entity</th>
                <th className="pb-2 font-medium">Trace ID</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {result.entries.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="py-2 pr-4 text-gray-500 whitespace-nowrap text-xs">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-gray-700">
                    {e.userName ?? <span className="text-gray-400">—</span>}
                  </td>
                  <td className="py-2 pr-4 font-mono text-xs text-gray-900">{e.action}</td>
                  <td className="py-2 pr-4 text-gray-500 text-xs">
                    {e.entityType ? `${e.entityType}:${e.entityId ?? "?"}` : "—"}
                  </td>
                  <td className="py-2 font-mono text-xs text-gray-400 truncate max-w-32" title={e.traceId}>
                    {e.traceId.slice(0, 12)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {page > 1 && (
            <Link
              href={`/admin/audit?${new URLSearchParams({ ...sp, page: String(page - 1) })}`}
              className="px-3 py-1.5 border rounded text-gray-700 hover:bg-gray-50"
            >
              Previous
            </Link>
          )}
          <span className="text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link
              href={`/admin/audit?${new URLSearchParams({ ...sp, page: String(page + 1) })}`}
              className="px-3 py-1.5 border rounded text-gray-700 hover:bg-gray-50"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
