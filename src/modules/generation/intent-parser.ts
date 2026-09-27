import { extractSignalKeywords } from "./text-utils";
import type {
  BloomTaxonomyLevel,
  GenerationConstraints,
  ParsedGenerationIntent,
  ParsedObjective,
} from "./types";

const OBJECTIVE_CODE_REGEX = /\b\d{1,2}(?:\.\d+){1,4}[A-Za-zА-Яа-я]?\b/u;

const BLOOM_VERB_PATTERNS: Array<{
  level: BloomTaxonomyLevel;
  patterns: RegExp[];
}> = [
  {
    level: "CREATE",
    patterns: [
      /\b(create|design|compose|develop|build|formulate|invent)\b/u,
      /\b(созда(й|ть)|разработ(ай|ать)|спроектиру(й|йте)|сформулиру(й|йте))\b/u,
    ],
  },
  {
    level: "EVALUATE",
    patterns: [
      /\b(evaluate|justify|critique|assess|argue|defend)\b/u,
      /\b(оцен(и|ить)|обосну(й|йте)|критическ(и|ое)|сравн(и|ить)\s+и\s+оцен(и|ить))\b/u,
    ],
  },
  {
    level: "ANALYZE",
    patterns: [
      /\b(analyze|compare|differentiate|examine|investigate|deconstruct)\b/u,
      /\b(проанализиру(й|йте)|сравн(и|ить)|исследу(й|йте)|разбер(и|ите))\b/u,
    ],
  },
  {
    level: "APPLY",
    patterns: [
      /\b(apply|solve|demonstrate|use|implement|calculate)\b/u,
      /\b(примен(и|ить)|реш(и|ить)|использу(й|йте)|продемонстриру(й|йте)|вычисл(и|ить))\b/u,
    ],
  },
  {
    level: "UNDERSTAND",
    patterns: [
      /\b(explain|describe|summarize|interpret|classify|outline)\b/u,
      /\b(объясн(и|ить)|опиш(и|ите)|охарактеризу(й|йте)|интерпретиру(й|йте)|классифициру(й|йте))\b/u,
    ],
  },
  {
    level: "REMEMBER",
    patterns: [
      /\b(list|define|identify|name|recall|state)\b/u,
      /\b(перечисл(и|ить)|определ(и|ить)|назов(и|ите)|вспомн(и|ить)|укаж(и|ите))\b/u,
    ],
  },
];

const BLOOM_ORDER: BloomTaxonomyLevel[] = [
  "REMEMBER",
  "UNDERSTAND",
  "APPLY",
  "ANALYZE",
  "EVALUATE",
  "CREATE",
];

function bloomByDifficulty(constraints: GenerationConstraints): BloomTaxonomyLevel {
  if (constraints.difficulty === "EASY") return "UNDERSTAND";
  if (constraints.difficulty === "HARD") return "ANALYZE";
  return "APPLY";
}

function normalizeStatement(raw: string): string {
  return raw
    .replace(/\t+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^(?:[-*\u2022]+|\d{1,2}[).](?!\d))\s*/u, "")
    .trim();
}

function splitGoalCandidates(raw: string): string[] {
  const normalized = raw.replace(/\r/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => normalizeStatement(line))
    .filter(Boolean);

  const candidates: string[] = [];

  for (const line of lines) {
    if (line.length <= 220) {
      candidates.push(line);
      continue;
    }

    const splitBySemicolon = line
      .split(/[;]+/u)
      .map((chunk) => normalizeStatement(chunk))
      .filter(Boolean);

    if (splitBySemicolon.length > 1) {
      candidates.push(...splitBySemicolon);
    } else {
      candidates.push(line);
    }
  }

  return [...new Set(candidates)];
}

export function detectBloomLevelFromText(statement: string): BloomTaxonomyLevel | null {
  const lower = statement.toLowerCase();
  for (const mapping of BLOOM_VERB_PATTERNS) {
    if (mapping.patterns.some((pattern) => pattern.test(lower))) {
      return mapping.level;
    }
  }
  return null;
}

function parseObjective(raw: string, index: number, fallbackBloom: BloomTaxonomyLevel): ParsedObjective | null {
  const statement = normalizeStatement(raw);
  if (!statement) return null;

  const codeMatch = statement.match(OBJECTIVE_CODE_REGEX);
  const code = codeMatch?.[0];
  const cleanedStatement = normalizeStatement(statement.replace(OBJECTIVE_CODE_REGEX, ""));
  const finalStatement = cleanedStatement || statement;

  if (finalStatement.length < 6) return null;

  const bloomLevel = detectBloomLevelFromText(finalStatement) ?? fallbackBloom;
  const keywords = extractSignalKeywords(finalStatement, 10);
  const actionVerb = finalStatement.split(/\s+/u)[0]?.toLowerCase();

  return {
    id: code ? `objective_${code.replace(/[^\p{L}\p{N}]+/gu, "_")}` : `objective_${index + 1}`,
    code,
    statement: finalStatement,
    actionVerb,
    bloomLevel,
    keywords,
  };
}

function parseInstructionObjectives(
  additionalInstructions: string | undefined,
  fallbackBloom: BloomTaxonomyLevel
): ParsedObjective[] {
  if (!additionalInstructions?.trim()) return [];

  const lines = splitGoalCandidates(additionalInstructions).filter((line) => {
    if (line.length < 20 || line.length > 260) return false;
    return detectBloomLevelFromText(line) !== null || /\b(students?|learners?)\b/iu.test(line);
  });

  return lines
    .slice(0, 8)
    .map((line, idx) => parseObjective(line, idx, fallbackBloom))
    .filter((value): value is ParsedObjective => Boolean(value));
}

function dedupeObjectives(objectives: ParsedObjective[]): ParsedObjective[] {
  const seen = new Set<string>();
  const result: ParsedObjective[] = [];

  for (const objective of objectives) {
    const signature = objective.statement.toLowerCase();
    if (seen.has(signature)) continue;
    seen.add(signature);
    result.push(objective);
  }

  return result;
}

function trimObjectives(objectives: ParsedObjective[], questionCount: number): ParsedObjective[] {
  const cap = Math.max(1, Math.min(12, questionCount * 2));
  return objectives.slice(0, cap);
}

function buildFallbackObjective(
  constraints: GenerationConstraints,
  fallbackBloom: BloomTaxonomyLevel
): ParsedObjective {
  const topic = constraints.topic.trim();
  const section = constraints.section?.trim();
  const statement = section
    ? `Cover ${topic} in section ${section}`
    : `Cover ${topic}`;

  return {
    id: "objective_topic_fallback",
    statement,
    actionVerb: "cover",
    bloomLevel: fallbackBloom,
    keywords: extractSignalKeywords(statement, 10),
  };
}

function buildGoalText(constraints: GenerationConstraints): string {
  return [constraints.educationalGoals, constraints.additionalInstructions]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join("\n");
}

function sortObjectivesByBloom(objectives: ParsedObjective[]): ParsedObjective[] {
  return [...objectives].sort((a, b) => {
    const aRank = BLOOM_ORDER.indexOf(a.bloomLevel);
    const bRank = BLOOM_ORDER.indexOf(b.bloomLevel);
    return bRank - aRank;
  });
}

export function parseGenerationIntent(constraints: GenerationConstraints): ParsedGenerationIntent {
  const fallbackBloom = bloomByDifficulty(constraints);
  const rawGoals = constraints.educationalGoals?.trim() ?? "";

  let objectives = splitGoalCandidates(rawGoals)
    .map((candidate, idx) => parseObjective(candidate, idx, fallbackBloom))
    .filter((value): value is ParsedObjective => Boolean(value));

  if (objectives.length === 0) {
    objectives = parseInstructionObjectives(constraints.additionalInstructions, fallbackBloom);
  }

  const fallbackObjectiveUsed = objectives.length === 0;
  if (fallbackObjectiveUsed) {
    objectives = [buildFallbackObjective(constraints, fallbackBloom)];
  }

  const dedupedObjectives = trimObjectives(
    sortObjectivesByBloom(dedupeObjectives(objectives)),
    constraints.questionCount
  );

  const sectionTerms = constraints.section ? extractSignalKeywords(constraints.section, 8) : [];
  const topicTerms = extractSignalKeywords(constraints.topic, 10);
  const additionalInstructionKeywords = extractSignalKeywords(
    (constraints.additionalInstructions ?? "").slice(0, 5000),
    16
  );

  return {
    objectives: dedupedObjectives,
    fallbackObjectiveUsed,
    sectionTerms,
    topicTerms,
    additionalInstructionKeywords,
  };
}

export function buildRetrievalTopicQuery(
  constraints: GenerationConstraints,
  intent: ParsedGenerationIntent
): string {
  const pieces = [
    constraints.topic.trim(),
    constraints.section?.trim() ?? "",
    ...intent.objectives.slice(0, 4).map((objective) => objective.statement),
  ].filter(Boolean);

  return pieces.join(" | ").slice(0, 700);
}

export function buildRetrievalMaterialHints(
  intent: ParsedGenerationIntent,
  additionalHints: string[] = []
): string[] {
  const merged = [
    ...additionalHints,
    ...intent.sectionTerms,
    ...intent.topicTerms,
    ...intent.additionalInstructionKeywords,
    ...intent.objectives.flatMap((objective) => objective.keywords),
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set(merged)].slice(0, 36);
}
