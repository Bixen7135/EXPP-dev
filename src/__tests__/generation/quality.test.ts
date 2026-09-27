import { describe, expect, it } from "vitest";
import {
  evaluateGenerationQuality,
  planQualityRepairs,
} from "@/modules/generation/quality";
import type {
  GenerationConstraints,
  GenerationContent,
  ParsedGenerationIntent,
} from "@/modules/generation/types";

const constraints: GenerationConstraints = {
  topic: "Artificial intelligence",
  difficulty: "MEDIUM",
  format: "WORKSHEET",
  questionCount: 4,
  knowledgeMode: "INTERNAL_ONLY",
};

const intent: ParsedGenerationIntent = {
  fallbackObjectiveUsed: false,
  sectionTerms: ["artificial", "intelligence"],
  topicTerms: ["artificial", "intelligence"],
  additionalInstructionKeywords: [],
  objectives: [
    {
      id: "objective_ai_fields",
      code: "12.4.3.1",
      statement: "Analyze AI applications in education and healthcare",
      actionVerb: "analyze",
      bloomLevel: "ANALYZE",
      keywords: ["analyze", "ai", "education", "healthcare", "applications"],
    },
    {
      id: "objective_ai_risks",
      code: "12.4.3.2",
      statement: "Evaluate risks and benefits of AI in society",
      actionVerb: "evaluate",
      bloomLevel: "EVALUATE",
      keywords: ["evaluate", "risks", "benefits", "society", "ai"],
    },
  ],
};

describe("generation quality gate", () => {
  it("flags low complexity, repetition, type diversity, and missing count", () => {
    const content: GenerationContent = {
      title: "AI worksheet",
      instructions: "Answer all questions",
      items: [
        {
          order: 1,
          type: "SHORT_ANSWER",
          question: "What is AI?",
          expectedAnswer: "AI is artificial intelligence.",
          maxScore: 1,
        },
        {
          order: 2,
          type: "SHORT_ANSWER",
          question: "What is AI?",
          expectedAnswer: "AI means machine intelligence.",
          maxScore: 1,
        },
        {
          order: 3,
          type: "SHORT_ANSWER",
          question: "List examples of AI tools.",
          expectedAnswer: "Chatbot, recommender system.",
          maxScore: 1,
        },
      ],
    };

    const evaluation = evaluateGenerationQuality({
      content,
      constraints,
      intent,
    });

    expect(evaluation.report.passed).toBe(false);
    expect(evaluation.issueCodes).toContain("quality.low_complexity");
    expect(evaluation.issueCodes).toContain("quality.duplicate_item");
    expect(evaluation.issueCodes).toContain("quality.low_type_diversity");
    expect(evaluation.issueCodes).toContain("quality.missing_questions");
    expect(evaluation.missingCount).toBe(1);
  });

  it("plans append+replace repair targets for failing content", () => {
    const content: GenerationContent = {
      title: "AI worksheet",
      instructions: "Answer all questions",
      items: [
        {
          order: 1,
          type: "SHORT_ANSWER",
          question: "What is AI?",
          expectedAnswer: "AI is artificial intelligence.",
          maxScore: 1,
        },
        {
          order: 2,
          type: "SHORT_ANSWER",
          question: "What is AI?",
          expectedAnswer: "AI means machine intelligence.",
          maxScore: 1,
        },
        {
          order: 3,
          type: "SHORT_ANSWER",
          question: "List examples of AI tools.",
          expectedAnswer: "Chatbot, recommender system.",
          maxScore: 1,
        },
      ],
    };

    const evaluation = evaluateGenerationQuality({
      content,
      constraints,
      intent,
    });

    const targets = planQualityRepairs({
      evaluation,
      content,
      constraints,
      intent,
    });

    expect(targets.some((target) => target.kind === "APPEND")).toBe(true);
    expect(targets.some((target) => target.kind === "REPLACE")).toBe(true);
  });
});
