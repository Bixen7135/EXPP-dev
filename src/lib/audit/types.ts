export type AuditAction =
  // Auth
  | "auth.register"
  | "auth.login"
  | "auth.logout"
  | "auth.login_failed"
  | "auth.rate_limited"
  | "auth.session_expired"
  // Route access
  | "access.denied"
  // Materials
  | "material.upload"
  | "material.delete"
  | "material.upload_failed"
  // Generation
  | "generation.request.created"
  | "generation.request.regenerated"
  | "generation.request.failed"
  // Assignments
  | "assignment.created"
  | "assignment.updated"
  | "assignment.published"
  | "assignment.version.restored"
  // Distribution
  | "distribution.created"
  // Attempts
  | "attempt.started"
  | "attempt.draft.saved"
  | "attempt.submitted"
  // AI Help
  | "ai_help.allowed"
  | "ai_help.blocked"
  // Assessment
  | "assessment.auto_checked"
  | "assessment.ai_queued"
  | "assessment.ai_started"
  | "assessment.ai_ready"
  | "assessment.ai_failed"
  | "assessment.ai_rerun"
  | "assessment.reviewed"
  | "assessment.published"
  // Generic for future phases
  | string;

export interface AuditContext {
  ip?: string;
  userAgent?: string;
  [key: string]: unknown;
}

export interface AuditEventPayload {
  userId?: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  context?: AuditContext;
  traceId: string;
}
