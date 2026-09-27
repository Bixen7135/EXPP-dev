import { notFound, redirect } from "next/navigation";
import { SettingsPage } from "@/components/dashboard/SettingsPage";
import { canAccessAdminWorkspace } from "@/lib/auth/authorization";
import { resolveSession } from "@/lib/auth/session";

export default async function AdminSettingsPage() {
  const session = await resolveSession();
  if (!session) {
    redirect("/sign-in");
  }
  if (!canAccessAdminWorkspace(session)) {
    notFound();
  }

  return (
    <SettingsPage
      session={session}
      profileHref="/admin/profile"
      settingsHref="/admin/settings"
    />
  );
}
