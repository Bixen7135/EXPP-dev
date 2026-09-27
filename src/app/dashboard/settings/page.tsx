import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/auth/session";

export default async function DashboardSettingsPage() {
  const session = await resolveSession();
  if (!session) {
    redirect("/sign-in");
  }

  redirect("/dashboard/settings/account");
}
