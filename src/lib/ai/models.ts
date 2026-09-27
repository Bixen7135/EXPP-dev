export const DEFAULT_OPENAI_MODEL = "gpt-5.4";
export const CURRENT_OPENAI_MODEL = "gpt-4o-mini";

interface ResolveAiModelOptions {
  explicitModelId?: string;
  scopedEnvKey?: string;
}

function isTrueFlag(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function resolveAiModel(opts: ResolveAiModelOptions = {}): string {
  const explicitModel = nonEmpty(opts.explicitModelId);
  const scopedModel = opts.scopedEnvKey ? nonEmpty(process.env[opts.scopedEnvKey]) : undefined;
  const globalModel = nonEmpty(process.env.AI_MODEL);
  const useCurrentModel = isTrueFlag(process.env.AI_USE_CURRENT_MODEL);
  const currentModel = nonEmpty(process.env.AI_MODEL_CURRENT);
  const fallbackModel = useCurrentModel
    ? currentModel ?? CURRENT_OPENAI_MODEL
    : DEFAULT_OPENAI_MODEL;

  return explicitModel ?? scopedModel ?? globalModel ?? fallbackModel;
}
