import { notFound, redirect } from "next/navigation";
import { ProfilePage } from "@/components/dashboard/ProfilePage";
import { canAccessTeacherWorkspace } from "@/lib/auth/authorization";
import { resolveSession } from "@/lib/auth/session";

export default async function TeacherProfilePage() {
  const session = await resolveSession();
  if (!session) {
    redirect("/sign-in");
  }
  if (!canAccessTeacherWorkspace(session)) {
    notFound();
  }

  return (
    <ProfilePage
      session={session}
      profileHref="/teacher/profile"
      settingsHref="/teacher/settings"
    />
  );
}
