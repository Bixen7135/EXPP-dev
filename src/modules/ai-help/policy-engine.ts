import type { AiHelpMode } from "./mode-definitions";
import { MANDATORY_GRADED_ALLOWED_MODES } from "./mode-definitions";

export interface PolicyContext {
  mode: AiHelpMode;
  isMandatory: boolean;
  isGraded: boolean;
  attemptStatus: "DRAFT" | "SUBMITTED";
  /** True when teacher has published the result (Phase 6). Unlocks POST_ASSESSMENT mode. */
  resultPublished?: boolean;
}

export interface PolicyResult {
  allowed: boolean;
  blockReason?: string;
}

/**
 * Layer 2 (Server) and Layer 3 (Gateway) policy check.
 * Called independently in both the API route handler AND the AI help gateway
 * to provide defense-in-depth enforcement.
 */
export function checkHelpPolicy(ctx: PolicyContext): PolicyResult {
  // NO_HELP: AI assistance is disabled for this assignment
  if (ctx.mode === "NO_HELP") {
    return { allowed: false, blockReason: "AI help is disabled for this assignment" };
  }

  // POST_ASSESSMENT: only available after result publication (Phase 6)
  if (ctx.mode === "POST_ASSESSMENT") {
    if (!ctx.resultPublished) {
      return {
        allowed: false,
        blockReason:
          "Post-assessment review is not yet available. It will be enabled after your results are published.",
      };
    }
    // Result is published — allow POST_ASSESSMENT requests
    return { allowed: true };
  }

  // After submission: no further help is allowed (for non-POST_ASSESSMENT modes)
  if (ctx.attemptStatus === "SUBMITTED") {
    return { allowed: false, blockReason: "Assignment has already been submitted" };
  }

  // CLARIFICATION and GUIDED are allowed before submission
  return { allowed: true };
}

/**
 * Validate that the AI help mode is compatible with the distribution settings.
 * Called at distribution creation time.
 */
export function validateDistributionMode(
  mode: AiHelpMode,
  isMandatory: boolean,
  isGraded: boolean
): { valid: boolean; reason?: string } {
  if (isMandatory && isGraded && !MANDATORY_GRADED_ALLOWED_MODES.includes(mode)) {
    return {
      valid: false,
      reason: `AI mode '${mode}' is not permitted for mandatory graded assignments. Allowed modes: ${MANDATORY_GRADED_ALLOWED_MODES.join(", ")}`,
    };
  }
  return { valid: true };
}
