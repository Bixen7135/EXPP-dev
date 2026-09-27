import { notFound, redirect } from "next/navigation";
import { SettingsPage } from "@/components/dashboard/SettingsPage";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { resolveSession } from "@/lib/auth/session";

export default async function TeacherSettingsPage() {
  const session = await resolveSession();
  if (!session) {
    redirect("/sign-in");
  }
  if (!canAccessTeacherWorkspace(session)) {
    notFound();
  }

  return (
    <SettingsPage
      session={session}
      profileHref="/teacher/profile"
      settingsHref="/teacher/settings"
    />
  );
}
