import { notFound, redirect } from "next/navigation";
import { SettingsPage } from "@/components/dashboard/SettingsPage";
import { canAccessStudentWorkspace } from "@/lib/auth/authorization";
import { resolveSession } from "@/lib/auth/session";

export default async function StudentSettingsPage() {
  const session = await resolveSession();
  if (!session) {
    redirect("/sign-in");
  }
  if (!canAccessStudentWorkspace(session)) {
    notFound();
  }

  return (
    <SettingsPage
      session={session}
      profileHref="/student/profile"
      settingsHref="/student/settings"
    />
  );
}
