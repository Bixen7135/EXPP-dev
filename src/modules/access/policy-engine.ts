import type { AiHelpMode } from "@/modules/ai-help/mode-definitions";

export interface AccessContext {
  permissions: string[];
}

export const GLOBAL_DEFAULT_PERMISSIONS = [
  "workspace.teacher",
  "workspace.student",
  "materials.manage",
  "generation.manage",
  "assignments.manage",
  "distribution.manage",
  "attempts.manage",
  "assessment.review",
  "analytics.view.self",
];

export function hasPermission(ctx: AccessContext, required: string): boolean {
  if (ctx.permissions.includes("*")) return true;
  if (ctx.permissions.includes(required)) return true;

  // Support wildcard prefixes, e.g. "analytics.*"
  const [prefix] = required.split(".");
  return ctx.permissions.includes(`${prefix}.*`);
}

export function hasAnyPermission(
  ctx: AccessContext,
  required: string[]
): boolean {
  return required.some((perm) => hasPermission(ctx, perm));
}

export function resolveStrictestAiModes(
  policyLayers: AiHelpMode[][]
): AiHelpMode[] {
  const nonEmpty = policyLayers.filter((layer) => layer.length > 0);
  if (nonEmpty.length === 0) {
    return ["NO_HELP", "CLARIFICATION", "GUIDED", "POST_ASSESSMENT"];
  }

  return nonEmpty.reduce<AiHelpMode[]>((intersection, layer) => {
    return intersection.filter((mode) => layer.includes(mode));
  }, nonEmpty[0]);
}
