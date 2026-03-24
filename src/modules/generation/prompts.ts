import type { GenerationConstraints, GenerationPlanOutline } from "./types";

export function buildPlanningSystemPrompt(): string {
  return `You are an educational content planner helping a teacher create assignments.
Given the teacher's constraints and source material context, create a detailed plan for the assignment.
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
  materialContext: string
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

export function buildGenerationSystemPrompt(): string {
  return `You are an educational content generator. Given an assignment plan and source materials, generate the actual assignment content.
You MUST return ONLY a valid JSON object - no markdown, no code fences, no explanation.
The JSON must match this exact structure:
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
}
Note:
- "options" is only required for MULTIPLE_CHOICE. Omit it for SHORT_ANSWER and LONG_ANSWER.
- "maxScore" is required for each item.
- "rubricCriteria" is required for each item and weight sum should be equal to "maxScore".`;
}

export function buildGenerationUserPrompt(
  outline: GenerationPlanOutline,
  constraints: GenerationConstraints,
  materialContext: string
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
  ];
  if (constraints.educationalGoals)
    lines.push(`- Educational goals: ${constraints.educationalGoals}`);
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
