import { z } from "zod";
import { aiGenerate } from "@/lib/ai/gateway";
import { resolveAiModel } from "@/lib/ai/models";
import { validateAndNormalizeExternalUrl } from "./external-sources";
import { parseAiJson } from "./ai-json";

const MAX_EXPLICIT_URLS = 10;
const MAX_SUGGESTED_URLS = 10;
const MAX_HINTS = 20;

const linkExtractionSchema = z.object({
  explicitUrls: z.array(z.string()).max(30).default([]),
  suggestedUrls: z
    .array(
      z.object({
        url: z.string(),
        reason: z.string().optional(),
        confidence: z.number().min(0).max(1).optional(),
      })
    )
    .max(30)
    .default([]),
  materialHints: z.array(z.string()).max(50).default([]),
});

export interface LinkExtractionResult {
  explicitUrls: string[];
  suggestedUrls: string[];
  materialHints: string[];
  warnings: string[];
}

function regexExtractUrls(input: string): string[] {
  const matches = input.match(/https?:\/\/[^\s"'<>\])]+/g) ?? [];
  return [...new Set(matches)];
}

async function normalizeUrlList(urls: string[], maxUrls: number): Promise<{ urls: string[]; warnings: string[] }> {
  const warnings: string[] = [];
  const normalized: string[] = [];

  for (const raw of urls) {
    if (normalized.length >= maxUrls) break;

    try {
      const valid = await validateAndNormalizeExternalUrl(raw);
      if (!normalized.includes(valid)) {
        normalized.push(valid);
      }
    } catch (error) {
      warnings.push(
        `URL skipped (${raw}): ${error instanceof Error ? error.message : "invalid URL"}`
      );
    }
  }

  return { urls: normalized, warnings };
}

function buildSystemPrompt(): string {
  return [
    "You extract learning-relevant links and source hints from teacher instructions.",
    "Return strict JSON only with no markdown.",
    "Do not fabricate explicit URLs. Keep explicitUrls only from input text.",
    "suggestedUrls may include new URLs relevant to the topic and instruction intent.",
    "Schema:",
    JSON.stringify({
      explicitUrls: ["https://example.com"],
      suggestedUrls: [{ url: "https://example.com", reason: "short", confidence: 0.7 }],
      materialHints: ["keyword"],
    }),
  ].join("\n");
}

function buildUserPrompt(topic: string, additionalInstructions: string): string {
  return [
    "Topic:",
    topic,
    "",
    "Additional instructions:",
    additionalInstructions,
    "",
    "Extract explicit urls, suggested urls, and material hints.",
  ].join("\n");
}

export async function extractLinksFromAdditionalInstructions(opts: {
  topic: string;
  additionalInstructions?: string;
  traceId?: string;
}): Promise<LinkExtractionResult> {
  const additionalInstructions = (opts.additionalInstructions ?? "").trim();
  if (!additionalInstructions) {
    return {
      explicitUrls: [],
      suggestedUrls: [],
      materialHints: [],
      warnings: [],
    };
  }

  const warnings: string[] = [];
  const fallbackExplicit = regexExtractUrls(additionalInstructions);

  let aiParsed: z.infer<typeof linkExtractionSchema> | null = null;
  try {
    const result = await aiGenerate({
      modelId: resolveAiModel({ scopedEnvKey: "AI_MODEL_PLANNER" }),
      label: "generation.link_extract",
      traceId: opts.traceId,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        {
          role: "user",
          content: buildUserPrompt(opts.topic, additionalInstructions),
        },
      ],
      maxTokens: 900,
      temperature: 0.2,
    });

    aiParsed = linkExtractionSchema.parse(
      parseAiJson<unknown>(result.text, "link extraction")
    );
  } catch {
    warnings.push("AI link extraction failed; falling back to explicit URL regex extraction");
  }

  const aiExplicit = aiParsed?.explicitUrls ?? [];
  const mergedExplicit = [...new Set([...fallbackExplicit, ...aiExplicit])];

  const suggestedRaw = (aiParsed?.suggestedUrls ?? [])
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .map((entry) => entry.url);

  const normalizedExplicit = await normalizeUrlList(mergedExplicit, MAX_EXPLICIT_URLS);
  const normalizedSuggested = await normalizeUrlList(suggestedRaw, MAX_SUGGESTED_URLS);

  warnings.push(...normalizedExplicit.warnings, ...normalizedSuggested.warnings);

  const materialHints = [...new Set((aiParsed?.materialHints ?? []).map((item) => item.trim()).filter(Boolean))]
    .slice(0, MAX_HINTS);

  return {
    explicitUrls: normalizedExplicit.urls,
    suggestedUrls: normalizedSuggested.urls,
    materialHints,
    warnings,
  };
}

export const linkExtractionConstants = {
  MAX_EXPLICIT_URLS,
  MAX_SUGGESTED_URLS,
  MAX_HINTS,
};
