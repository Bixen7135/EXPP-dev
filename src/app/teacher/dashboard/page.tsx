import { resolveSession } from "@/lib/auth/session";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function TeacherDashboardPage() {
  const user = await resolveSession();
  if (!user) {
    redirect("/login");
  }
  if (user.domain === "GLOBAL") {
    redirect("/dashboard");
  }
  if (!canAccessTeacherWorkspace(user)) {
    redirect("/login");
  }

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Teacher Dashboard</h1>
        <p className="mt-1 text-gray-600">Welcome, {user.name}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: "Materials", href: "/teacher/materials", desc: "Upload and manage teaching materials" },
          { label: "Generate", href: "/teacher/generate", desc: "Create assignments from materials" },
          { label: "Assignments", href: "/teacher/assignments", desc: "Edit, version, and publish assignments" },
          { label: "Analytics", href: "/teacher/analytics", desc: "Track engagement and submissions" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="border rounded-lg p-4 hover:border-blue-400 hover:bg-blue-50 transition-colors space-y-1"
          >
            <p className="font-semibold text-gray-900">{item.label}</p>
            <p className="text-xs text-gray-500">{item.desc}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
