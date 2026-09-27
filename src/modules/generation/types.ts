export type DifficultyLevel = "EASY" | "MEDIUM" | "HARD";
export type GenerationFormat = "SINGLE_ASSIGNMENT" | "WORKSHEET";
export type GenerationStatus =
  | "PENDING"
  | "QUEUED"
  | "PLANNING"
  | "RETRIEVING"
  | "GENERATING"
  | "VALIDATING"
  | "READY"
  | "ERROR"
  | "CANCELLED";

export type KnowledgeMode = "INTERNAL_ONLY" | "HYBRID_EXTERNAL";
export type BloomTaxonomyLevel =
  | "REMEMBER"
  | "UNDERSTAND"
  | "APPLY"
  | "ANALYZE"
  | "EVALUATE"
  | "CREATE";

export interface GenerationConstraints {
  topic: string;
  section?: string;
  difficulty: DifficultyLevel;
  format: GenerationFormat;
  questionCount: number;
  educationalGoals?: string;
  additionalInstructions?: string;
  knowledgeMode?: KnowledgeMode;
  externalSourceProfileId?: string;
}

export interface ParsedObjective {
  id: string;
  code?: string;
  statement: string;
  actionVerb?: string;
  bloomLevel: BloomTaxonomyLevel;
  keywords: string[];
}

export interface ParsedGenerationIntent {
  objectives: ParsedObjective[];
  fallbackObjectiveUsed: boolean;
  sectionTerms: string[];
  topicTerms: string[];
  additionalInstructionKeywords: string[];
}

export interface GenerationItemSource {
  type: "INTERNAL" | "EXTERNAL";
  ref: string;
  title?: string;
  excerpt?: string;
}

export interface GenerationItemContent {
  order: number;
  type: "SHORT_ANSWER" | "MULTIPLE_CHOICE" | "LONG_ANSWER";
  question: string;
  options?: string[];
  expectedAnswer: string;
  maxScore?: number;
  sources?: GenerationItemSource[];
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

export interface GenerationStageProgress {
  stage: GenerationStatus;
  startedAt: string;
  finishedAt?: string;
  detail?: string;
}

export interface GenerationBatchCounter {
  completed: number;
  total: number;
}

export interface LinkExtractionMetadata {
  explicitUrls: string[];
  suggestedUrls: string[];
  usedUrls: string[];
  materialHints: string[];
}

export type GenerationQualityIssueCode =
  | "quality.low_complexity"
  | "quality.duplicate_item"
  | "quality.objective_coverage_partial"
  | "quality.low_type_diversity"
  | "quality.missing_questions"
  | "quality.best_effort_after_retries"
  | "quality.repair_failed";

export interface GenerationQualityIssue {
  code: GenerationQualityIssueCode;
  message: string;
}

export interface GenerationItemQualityReport {
  order: number;
  bloomLevel: BloomTaxonomyLevel;
  objectiveId?: string;
  issues: GenerationQualityIssue[];
}

export interface GenerationQualitySummary {
  issueCodes: GenerationQualityIssueCode[];
  missingCount: number;
  objectiveCoverage: Record<string, number>;
  complexityRatios: {
    applyPlus: number;
    analyzePlus: number;
    evaluatePlus: number;
  };
  typeDiversity: number;
}

export interface GenerationQualityReport {
  passed: boolean;
  passCount: number;
  itemReports: GenerationItemQualityReport[];
  summary: GenerationQualitySummary;
}

export interface GenerationIntentSnapshot {
  fallbackObjectiveUsed: boolean;
  sectionTerms: string[];
  topicTerms: string[];
  objectives: Array<{
    id: string;
    code?: string;
    bloomLevel: BloomTaxonomyLevel;
    keywords: string[];
  }>;
}

export interface GenerationRunMetadata {
  stageProgress: GenerationStageProgress[];
  warnings: string[];
  currentStage?: GenerationStatus;
  progressPercent?: number;
  batchCounters?: Record<string, GenerationBatchCounter>;
  linkExtraction?: LinkExtractionMetadata;
  parsedIntent?: GenerationIntentSnapshot;
  qualityReport?: GenerationQualityReport;
  partial?: boolean;
}

export interface GenerationRequestSummary {
  id: string;
  ownerAccountId: string;
  status: GenerationStatus;
  constraints: GenerationConstraints;
  materialIds: string[];
  runToken: number;
  metadata: GenerationRunMetadata | null;
  cancelRequestedAt: Date | null;
  cancelReason: string | null;
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
