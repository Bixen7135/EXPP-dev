import { notFound, redirect } from "next/navigation";
import { ProfilePage } from "@/components/dashboard/ProfilePage";
import { canAccessAdminWorkspace } from "@/lib/auth/authorization";
import { resolveSession } from "@/lib/auth/session";

export default async function AdminProfilePage() {
  const session = await resolveSession();
  if (!session) {
    redirect("/sign-in");
  }
  if (!canAccessAdminWorkspace(session)) {
    notFound();
  }

  return (
    <ProfilePage
      session={session}
      profileHref="/admin/profile"
      settingsHref="/admin/settings"
    />
  );
}
