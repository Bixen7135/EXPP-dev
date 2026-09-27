import { notFound, redirect } from "next/navigation";
import { ProfilePage } from "@/components/dashboard/ProfilePage";
import { canAccessStudentWorkspace } from "@/lib/auth/authorization";
import { resolveSession } from "@/lib/auth/session";

export default async function StudentProfilePage() {
  const session = await resolveSession();
  if (!session) {
    redirect("/sign-in");
  }
  if (!canAccessStudentWorkspace(session)) {
    notFound();
  }

  return (
    <ProfilePage
      session={session}
      profileHref="/student/profile"
      settingsHref="/student/settings"
    />
  );
}
