import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveSession } from "@/lib/auth/session";
import { listUsers } from "@/modules/admin/service";
import UserActions from "./UserActions";

export default async function AdminUsersPage() {
  const session = await resolveSession();
  if (!session || session.role !== "ADMIN") notFound();

  const users = await listUsers();

  const byRole = {
    ADMIN: users.filter((u) => u.role === "ADMIN"),
    TEACHER: users.filter((u) => u.role === "TEACHER"),
    STUDENT: users.filter((u) => u.role === "STUDENT"),
  };

  return (
    <main className="p-8 max-w-5xl mx-auto space-y-6">
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/dashboard" className="hover:text-gray-700">Admin</Link>
        <span>/</span>
        <span className="text-gray-900">Users</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">User Management</h1>
        <span className="text-sm text-gray-500">{users.length} users total</span>
      </div>

      {(["ADMIN", "TEACHER", "STUDENT"] as const).map((role) => (
        <section key={role}>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {role}S ({byRole[role].length})
          </h2>
          {byRole[role].length === 0 ? (
            <p className="text-sm text-gray-400">None</p>
          ) : (
            <ul className="space-y-2">
              {byRole[role].map((u) => (
                <li
                  key={u.id}
                  className={`border rounded-lg p-4 flex items-center justify-between gap-4 ${
                    !u.isActive ? "opacity-60" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium">{u.name}</p>
                    <p className="text-sm text-gray-500">{u.email}</p>
                    <p className="text-xs text-gray-400">
                      Joined {new Date(u.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {!u.isActive && (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                        Deactivated
                      </span>
                    )}
                    <UserActions user={u} currentUserId={session.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </main>
  );
}
