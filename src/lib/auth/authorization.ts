import type { SessionUser } from "@/lib/auth/session";
import { hasAnyPermission, hasPermission } from "@/modules/access/policy-engine";

export function canAccessTeacherWorkspace(session: SessionUser): boolean {
  return hasAnyPermission(session, ["workspace.teacher", "workspace.admin"]);
}

export function canAccessStudentWorkspace(session: SessionUser): boolean {
  return hasPermission(session, "workspace.student");
}

export function canAccessAdminWorkspace(session: SessionUser): boolean {
  return hasPermission(session, "workspace.admin");
}

