export type DifficultyLevel = "EASY" | "MEDIUM" | "HARD";
export type GenerationFormat = "SINGLE_ASSIGNMENT" | "WORKSHEET";
export type GenerationStatus = "PENDING" | "PLANNING" | "GENERATING" | "READY" | "ERROR";

export interface GenerationConstraints {
  topic: string;
  section?: string;
  difficulty: DifficultyLevel;
  format: GenerationFormat;
  questionCount: number;
  educationalGoals?: string;
  additionalInstructions?: string;
}

export interface GenerationItemContent {
  order: number;
  type: "SHORT_ANSWER" | "MULTIPLE_CHOICE" | "LONG_ANSWER";
  question: string;
  options?: string[];
  expectedAnswer: string;
  maxScore?: number;
  rubricCriteria?: Array<{
    id: string;
    title: string;
    description: string;
    weight: number;
    type?: "EXPECTATION" | "PENALTY";
  }>;
}

export interface GenerationContent {
  title: string;
  instructions: string;
  items: GenerationItemContent[];
}

export interface GenerationPlanOutline {
  title: string;
  sections: Array<{
    title: string;
    items: string[];
  }>;
  totalQuestions: number;
  rationale?: string;
}

export interface GenerationRequestSummary {
  id: string;
  teacherId: string;
  status: GenerationStatus;
  constraints: GenerationConstraints;
  materialIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerationRequestDetail extends GenerationRequestSummary {
  plan: GenerationPlanOutline | null;
  result: {
    id: string;
    content: GenerationContent;
    format: string;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
  } | null;
}
