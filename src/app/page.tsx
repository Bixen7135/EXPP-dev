import { redirect } from "next/navigation";
import { resolveSession } from "@/lib/auth/session";

export default async function Home() {
  const session = await resolveSession();

  if (!session) {
    redirect("/login");
  }

  switch (session.role) {
    case "TEACHER":
    case "ADMIN":
      redirect("/teacher/dashboard");
    case "STUDENT":
      redirect("/student/dashboard");
    default:
      redirect("/login");
  }
}
