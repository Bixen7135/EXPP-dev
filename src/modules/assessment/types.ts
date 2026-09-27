export type AssessmentStatus = "PENDING" | "AUTO_CHECKED" | "REVIEWED" | "PUBLISHED";
export type AutoCheckStatus = "NOT_STARTED" | "QUEUED" | "PROCESSING" | "READY" | "FAILED";
export type AssessmentAiRunTrigger = "AUTO_ON_SUBMIT" | "MANUAL_RERUN";
export type AssessmentAiRunStatus = "QUEUED" | "PROCESSING" | "READY" | "FAILED";
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

// Per-item result from deterministic auto-check.
export interface ItemCheckResult {
  itemOrder: number;
  autoScore: number;
  maxScore: number;
  isAutoCheckable: boolean;
  isExactMatch?: boolean;
}

export interface AutoCheckResult {
  items: ItemCheckResult[];
  autoScore: number;
  autoMaxScore: number;
}

export interface AssessmentAiItemRecommendation {
  itemOrder: number;
  recommendedScore: number;
  maxScore: number;
  confidence: ConfidenceLevel;
  confidenceValue: number;
  riskFlags: string[];
  whatIsCorrect: string[];
  whatIsIncorrect: string[];
  whatIsMissing: string[];
  teacherFacingComment: string;
}

export interface AssessmentAiRecommendation {
  items: AssessmentAiItemRecommendation[];
  recommendedTotal: number;
  maxTotal: number;
  confidence: ConfidenceLevel;
  confidenceValue: number;
  warnings: string[];
  gradeRationale: string;
  reviewPriority: string[];
  promptVersion: string;
  generatedAt: string;
}

export interface AssessmentAiRunSummary {
  id: string;
  assessmentId: string;
  trigger: AssessmentAiRunTrigger;
  status: AssessmentAiRunStatus;
  model: string;
  promptVersion: string;
  inputHash: string;
  confidence: ConfidenceLevel | null;
  warnings: string[];
  error: string | null;
  traceId: string | null;
  queuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ItemScoreOverride {
  itemOrder: number;
  teacherScore: number;
  reason?: string;
}

// Full assessment detail - returned to teacher.
export interface AssessmentDetail {
  id: string;
  attemptId: string;
  reviewerAccountId: string;
  status: AssessmentStatus;
  autoCheckStatus: AutoCheckStatus;
  autoCheckResult: AutoCheckResult | null;
  aiRecommendation: AssessmentAiRecommendation | null;
  latestAiRun: AssessmentAiRunSummary | null;
  manualGrade: number | null;
  maxGrade: number | null;
  itemOverrides: ItemScoreOverride[];
  comment: string | null;
  reviewedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// Result shown to student - only available after PUBLISHED.
export interface StudentResult {
  assessmentId: string;
  attemptId: string;
  grade: number | null;
  maxGrade: number | null;
  comment: string | null;
  publishedAt: Date;
}
