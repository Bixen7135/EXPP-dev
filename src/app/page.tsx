import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/auth/session";
import { hasAnyPermission } from "@/modules/access/policy-engine";

export default async function Home() {
  const session = await resolveSession();

  if (!session) {
    redirect("/login");
  }

  if (session.domain === "GLOBAL") {
    redirect("/dashboard");
  }

  if (hasAnyPermission(session, ["workspace.admin", "workspace.teacher"])) {
    redirect("/teacher/dashboard");
  }

  if (hasAnyPermission(session, ["workspace.student"])) {
    redirect("/student/dashboard");
  }

  redirect("/login");
}
