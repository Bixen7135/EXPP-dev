import { resolveSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";

export default async function AdminDashboardPage() {
  const user = await resolveSession();
  if (!user || user.role !== "ADMIN") {
    redirect("/login");
  }

  const [userCount, auditCount] = await Promise.all([
    prisma.user.count(),
    prisma.auditEvent.count(),
  ]);

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="mt-1 text-gray-600">Welcome, {user.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">{userCount}</p>
          <p className="text-xs text-gray-500 mt-1">Total Users</p>
        </div>
        <div className="border rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">{auditCount}</p>
          <p className="text-xs text-gray-500 mt-1">Audit Events</p>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Admin Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/users"
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
          >
            Manage Users
          </Link>
          <Link
            href="/admin/audit"
            className="px-4 py-2 border rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            View Audit Log
          </Link>
        </div>
      </div>
    </main>
  );
}
