import type {
  BloomTaxonomyLevel,
  GenerationConstraints,
  GenerationPlanOutline,
  GenerationItemContent,
  ParsedGenerationIntent,
} from "./types";
import { QUESTION_SCORING_RULE_TEXT } from "@/lib/question-scoring";

function bloomRequirementsForDifficulty(
  constraints: GenerationConstraints
): string[] {
  if (constraints.difficulty === "HARD") {
    return [
      "- Hard target: at least 80% of items must be ANALYZE/EVALUATE/CREATE.",
      "- Hard target: at least 30% of items must be EVALUATE/CREATE.",
    ];
  }

  if (constraints.difficulty === "MEDIUM") {
    return [
      "- Medium target: at least 60% of items must be APPLY/ANALYZE/EVALUATE/CREATE.",
      "- Medium target: at least 30% of items must be ANALYZE/EVALUATE/CREATE.",
    ];
  }

  return [
    "- Easy target: mostly REMEMBER/UNDERSTAND/APPLY; avoid excessive advanced cognitive load.",
  ];
}

function objectiveBlock(parsedIntent?: ParsedGenerationIntent): string[] {
  if (!parsedIntent || parsedIntent.objectives.length === 0) {
    return [];
  }

  const lines = ["Educational objectives:"];

  for (const objective of parsedIntent.objectives) {
    const code = objective.code ? `${objective.code} ` : "";
    lines.push(
      `- ${code}${objective.statement} (Bloom: ${objective.bloomLevel})`
    );
  }

  return lines;
}

function itemDiversityRule(questionCount: number): string {
  if (questionCount >= 4) {
    return "Use at least two question types across the set (SHORT_ANSWER, MULTIPLE_CHOICE, LONG_ANSWER).";
  }
  return "Question type diversity is optional for this question count.";
}

export function buildPlanningSystemPrompt(): string {
  return `You are an educational content planner helping a teacher create assignments.
Given the teacher's constraints and source material context, create a detailed plan for the assignment.
Respect educational goals, Bloom cognitive targets, and assignment difficulty.
You MUST return ONLY a valid JSON object - no markdown, no code fences, no explanation.
The JSON must match this exact structure:
{
  "title": "string",
  "sections": [
    { "title": "string", "items": ["question idea 1", "question idea 2"] }
  ],
  "totalQuestions": number,
  "rationale": "string"
}`;
}

export function buildPlanningUserPrompt(
  constraints: GenerationConstraints,
  materialContext: string,
  parsedIntent?: ParsedGenerationIntent
): string {
  const lines = [
    "Create an assignment plan with these constraints:",
    `- Topic: ${constraints.topic}`,
  ];
  if (constraints.section) lines.push(`- Section: ${constraints.section}`);
  lines.push(`- Difficulty: ${constraints.difficulty}`);
  lines.push(`- Format: ${constraints.format}`);
  lines.push(`- Number of questions: ${constraints.questionCount}`);
  if (constraints.educationalGoals)
    lines.push(`- Educational goals: ${constraints.educationalGoals}`);
  if (constraints.additionalInstructions)
    lines.push(`- Additional instructions: ${constraints.additionalInstructions}`);
  lines.push(...bloomRequirementsForDifficulty(constraints));
  lines.push(`- ${itemDiversityRule(constraints.questionCount)}`);
  lines.push(...objectiveBlock(parsedIntent));
  lines.push("");
  if (materialContext) {
    lines.push("Source materials for context:");
    lines.push("");
    lines.push(materialContext);
  } else {
    lines.push(
      "No source materials provided. Create questions based on the topic and constraints alone."
    );
  }
  lines.push("");
  lines.push("Return ONLY the JSON plan.");
  return lines.join("\n");
}

export function buildSectionDraftSystemPrompt(): string {
  return `You generate draft assignment items for one section.
Follow teacher objectives and Bloom-level targets based on assignment difficulty.
Return ONLY valid JSON:
{
  "items": [
    {
      "order": number,
      "type": "SHORT_ANSWER" | "MULTIPLE_CHOICE" | "LONG_ANSWER",
      "question": "string",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "expectedAnswer": "string",
      "maxScore": number,
      "rubricCriteria": [
        {
          "id": "criterion_1",
          "title": "string",
          "description": "string",
          "weight": number,
          "type": "EXPECTATION" | "PENALTY"
        }
      ]
    }
  ]
}`;
}

export function buildSectionDraftUserPrompt(opts: {
  section: { title: string; items: string[] };
  sectionIndex: number;
  constraints: GenerationConstraints;
  materialContext: string;
  parsedIntent?: ParsedGenerationIntent;
  requiredItemCount?: number;
  retryAttempt?: number;
}): string {
  const requiredItemCount = Math.max(
    1,
    opts.requiredItemCount ?? opts.section.items.length
  );
  const lines = [
    `Generate section draft #${opts.sectionIndex + 1}: ${opts.section.title}`,
    "Section item ideas:",
    JSON.stringify(opts.section.items, null, 2),
    "",
    "Constraints:",
    `- Topic: ${opts.constraints.topic}`,
    `- Difficulty: ${opts.constraints.difficulty}`,
    `- Format: ${opts.constraints.format}`,
    `- Total question count target: ${opts.constraints.questionCount}`,
    `- Required items for this section: ${requiredItemCount}`,
    ...bloomRequirementsForDifficulty(opts.constraints),
    `- ${itemDiversityRule(opts.constraints.questionCount)}`,
    `- ${QUESTION_SCORING_RULE_TEXT}`,
  ];

  if (opts.constraints.educationalGoals) {
    lines.push(`- Educational goals: ${opts.constraints.educationalGoals}`);
  }
  if (opts.constraints.additionalInstructions) {
    lines.push(`- Additional instructions: ${opts.constraints.additionalInstructions}`);
  }
  lines.push(...objectiveBlock(opts.parsedIntent));

  lines.push("");
  if (opts.materialContext) {
    lines.push("Source context:");
    lines.push(opts.materialContext);
  }
  lines.push("");
  lines.push(
    `Return exactly ${requiredItemCount} items for this section.`,
    "Return only ONE JSON object with top-level key `items`.",
    "Keep `expectedAnswer` concise (1-2 sentences).",
    "If `rubricCriteria` is included, keep it concise (max 2 criteria per item)."
  );
  if ((opts.retryAttempt ?? 0) > 0) {
    lines.push(
      "Previous output was invalid. Strict JSON only; no prose, no markdown, no truncation."
    );
  }

  return lines.join("\n");
}

export function buildAssemblySystemPrompt(): string {
  return `You assemble final assignment JSON from section drafts.
You must preserve educational objective coverage and Bloom-level difficulty constraints.
Return ONLY valid JSON with this structure:
{
  "title": "string",
  "instructions": "string",
  "items": [
    {
      "order": number,
      "type": "SHORT_ANSWER" | "MULTIPLE_CHOICE" | "LONG_ANSWER",
      "question": "string",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "expectedAnswer": "string",
      "maxScore": number,
      "rubricCriteria": [
        {
          "id": "criterion_1",
          "title": "string",
          "description": "string",
          "weight": number,
          "type": "EXPECTATION" | "PENALTY"
        }
      ]
    }
  ]
}`;
}

export function buildAssemblyUserPrompt(opts: {
  outline: GenerationPlanOutline;
  constraints: GenerationConstraints;
  sectionDrafts: GenerationItemContent[][];
  materialContext: string;
  parsedIntent?: ParsedGenerationIntent;
}): string {
  const lines = [
    "Assemble final assignment JSON from this plan and section drafts.",
    "Plan:",
    JSON.stringify(opts.outline, null, 2),
    "",
    "Section drafts:",
    JSON.stringify(opts.sectionDrafts, null, 2),
    "",
    "Constraints:",
    `- Topic: ${opts.constraints.topic}`,
    `- Difficulty: ${opts.constraints.difficulty}`,
    `- Format: ${opts.constraints.format}`,
    `- Exact question count: ${opts.constraints.questionCount}`,
    ...bloomRequirementsForDifficulty(opts.constraints),
    `- ${itemDiversityRule(opts.constraints.questionCount)}`,
    `- ${QUESTION_SCORING_RULE_TEXT}`,
  ];

  if (opts.constraints.educationalGoals) {
    lines.push(`- Educational goals: ${opts.constraints.educationalGoals}`);
  }
  if (opts.constraints.additionalInstructions) {
    lines.push(`- Additional instructions: ${opts.constraints.additionalInstructions}`);
  }
  lines.push(...objectiveBlock(opts.parsedIntent));

  lines.push("");
  if (opts.materialContext) {
    lines.push("Source context:");
    lines.push(opts.materialContext);
  }

  lines.push("");
  lines.push("Return only final JSON content.");
  return lines.join("\n");
}

export function buildValidationSystemPrompt(): string {
  return `You validate assignment items against constraints.
Enforce objective coverage, Bloom-level fit for difficulty, and type diversity requirements.
Return ONLY valid JSON:
{
  "warnings": ["string"],
  "normalizedItems": [
    {
      "order": number,
      "type": "SHORT_ANSWER" | "MULTIPLE_CHOICE" | "LONG_ANSWER",
      "question": "string",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "expectedAnswer": "string",
      "maxScore": number,
      "rubricCriteria": [
        {
          "id": "criterion_1",
          "title": "string",
          "description": "string",
          "weight": number,
          "type": "EXPECTATION" | "PENALTY"
        }
      ]
    }
  ]
}`;
}

export function buildValidationUserPrompt(opts: {
  constraints: GenerationConstraints;
  batchItems: GenerationItemContent[];
  parsedIntent?: ParsedGenerationIntent;
}): string {
  return [
    "Validate and normalize these assignment items.",
    `Topic: ${opts.constraints.topic}`,
    `Difficulty: ${opts.constraints.difficulty}`,
    `Format: ${opts.constraints.format}`,
    `Expected total questions: ${opts.constraints.questionCount}`,
    ...bloomRequirementsForDifficulty(opts.constraints),
    itemDiversityRule(opts.constraints.questionCount),
    QUESTION_SCORING_RULE_TEXT,
    ...objectiveBlock(opts.parsedIntent),
    "Batch items:",
    JSON.stringify(opts.batchItems, null, 2),
  ].join("\n\n");
}

export function buildGenerationSystemPrompt(): string {
  return buildAssemblySystemPrompt();
}

export function buildGenerationUserPrompt(
  outline: GenerationPlanOutline,
  constraints: GenerationConstraints,
  materialContext: string,
  parsedIntent?: ParsedGenerationIntent
): string {
  return buildAssemblyUserPrompt({
    outline,
    constraints,
    sectionDrafts: [],
    materialContext,
    parsedIntent,
  });
}

export function buildLegacyGenerationUserPrompt(
  outline: GenerationPlanOutline,
  constraints: GenerationConstraints,
  materialContext: string,
  parsedIntent?: ParsedGenerationIntent
): string {
  const lines = [
    "Generate the assignment content based on this plan:",
    "",
    JSON.stringify(outline, null, 2),
    "",
    "Constraints:",
    `- Topic: ${constraints.topic}`,
    `- Difficulty: ${constraints.difficulty}`,
    `- Format: ${constraints.format}`,
    `- Question count: ${constraints.questionCount}`,
    ...bloomRequirementsForDifficulty(constraints),
    `- ${itemDiversityRule(constraints.questionCount)}`,
    `- ${QUESTION_SCORING_RULE_TEXT}`,
  ];
  if (constraints.educationalGoals)
    lines.push(`- Educational goals: ${constraints.educationalGoals}`);
  lines.push(...objectiveBlock(parsedIntent));
  lines.push("");
  if (materialContext) {
    lines.push("Source materials:");
    lines.push("");
    lines.push(materialContext);
  } else {
    lines.push("No source materials provided.");
  }
  lines.push("");
  lines.push(
    `Generate exactly ${constraints.questionCount} question(s). Return ONLY the JSON content.`
  );
  return lines.join("\n");
}

export interface QualityRepairPromptTarget {
  kind: "REPLACE" | "APPEND";
  index?: number;
  objectiveId?: string;
  preferredBloomLevel: BloomTaxonomyLevel;
  preferredType?: GenerationItemContent["type"];
  reasonCodes: string[];
}

export function buildQualityRepairSystemPrompt(): string {
  return `You repair low-quality assignment items while preserving teacher constraints.
Return ONLY valid JSON with this structure:
{
  "items": [
    {
      "order": number,
      "type": "SHORT_ANSWER" | "MULTIPLE_CHOICE" | "LONG_ANSWER",
      "question": "string",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "expectedAnswer": "string",
      "maxScore": number,
      "rubricCriteria": [
        {
          "id": "criterion_1",
          "title": "string",
          "description": "string",
          "weight": number,
          "type": "EXPECTATION" | "PENALTY"
        }
      ]
    }
  ]
}`;
}

export function buildQualityRepairUserPrompt(opts: {
  constraints: GenerationConstraints;
  parsedIntent: ParsedGenerationIntent;
  currentItems: GenerationItemContent[];
  targets: QualityRepairPromptTarget[];
  materialContext: string;
}): string {
  const objectiveById = new Map(
    opts.parsedIntent.objectives.map((objective) => [objective.id, objective])
  );

  const targetSpecs = opts.targets.map((target, index) => ({
    outputIndex: index + 1,
    action: target.kind,
    replaceItemOrder:
      target.kind === "REPLACE" && typeof target.index === "number"
        ? opts.currentItems[target.index]?.order ?? null
        : null,
    reasonCodes: target.reasonCodes,
    objective:
      target.objectiveId && objectiveById.get(target.objectiveId)
        ? {
            id: target.objectiveId,
            statement: objectiveById.get(target.objectiveId)?.statement,
            bloomLevel: objectiveById.get(target.objectiveId)?.bloomLevel,
          }
        : null,
    preferredBloomLevel: target.preferredBloomLevel,
    preferredType: target.preferredType ?? null,
  }));

  return [
    "Repair assignment items that violate quality constraints.",
    `Topic: ${opts.constraints.topic}`,
    `Difficulty: ${opts.constraints.difficulty}`,
    `Format: ${opts.constraints.format}`,
    `Question count target: ${opts.constraints.questionCount}`,
    ...bloomRequirementsForDifficulty(opts.constraints),
    itemDiversityRule(opts.constraints.questionCount),
    QUESTION_SCORING_RULE_TEXT,
    ...objectiveBlock(opts.parsedIntent),
    "Current items:",
    JSON.stringify(opts.currentItems, null, 2),
    "Targets to regenerate. Return exactly one item per target in the same order:",
    JSON.stringify(targetSpecs, null, 2),
    opts.materialContext
      ? `Source context:\n${opts.materialContext}`
      : "No source context available.",
  ].join("\n\n");
}

export function buildLinkExtractionSystemPrompt(): string {
  return [
    "You extract explicit and suggested source links from teacher instructions.",
    "Return strict JSON only.",
    "Do not invent explicit links if not present in input.",
    "Schema:",
    JSON.stringify({
      explicitUrls: ["https://example.com"],
      suggestedUrls: [
        {
          url: "https://example.com",
          reason: "short",
          confidence: 0.7,
        },
      ],
      materialHints: ["keyword"],
    }),
  ].join("\n");
}

export function buildLinkExtractionUserPrompt(opts: {
  topic: string;
  additionalInstructions: string;
}): string {
  return [
    `Topic: ${opts.topic}`,
    "Additional instructions:",
    opts.additionalInstructions,
    "",
    "Extract explicitUrls, suggestedUrls, and materialHints.",
  ].join("\n");
}

export const generationOrchestrationConstants = {
  SECTION_CONCURRENCY: 3,
  VALIDATION_BATCH_SIZE: 4,
  SECTION_DRAFT_MAX_ATTEMPTS: 3,
  SECTION_DRAFT_MAX_TOKENS: 2600,
};
