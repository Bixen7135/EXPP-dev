export type AssignmentStatus = "DRAFT" | "PUBLISHABLE" | "ASSIGNED";

export interface RubricCriterion {
  id: string;
  title: string;
  description: string;
  weight: number;
  type?: "EXPECTATION" | "PENALTY";
}

export interface AssignmentItemContent {
  order: number;
  type: "SHORT_ANSWER" | "MULTIPLE_CHOICE" | "LONG_ANSWER";
  question: string;
  options?: string[];
  expectedAnswer: string;
  maxScore?: number;
  rubricCriteria?: RubricCriterion[];
}

export interface AssignmentContent {
  title: string;
  instructions: string;
  items: AssignmentItemContent[];
}

export interface AssignmentVersionSummary {
  id: string;
  versionNumber: number;
  authorAccountId: string;
  changeDescription: string | null;
  createdAt: Date;
}

export interface AssignmentVersionDetail extends AssignmentVersionSummary {
  content: AssignmentContent;
}

export interface AssignmentSummary {
  id: string;
  ownerAccountId: string;
  generationResultId: string | null;
  title: string;
  status: AssignmentStatus;
  currentVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AssignmentDetail extends AssignmentSummary {
  content: AssignmentContent;
  versions: AssignmentVersionSummary[];
}
