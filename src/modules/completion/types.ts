import type { AiHelpMode } from "@/modules/ai-help/mode-definitions";
import type { AssignmentItemContent } from "@/modules/assignments/types";

export type AttemptStatus = "DRAFT" | "SUBMITTED";

export interface AttemptAnswer {
  itemOrder: number;
  text: string;
}

// Assignment content shown to students — expected answers are stripped
export interface StudentItemContent {
  order: number;
  type: "SHORT_ANSWER" | "MULTIPLE_CHOICE" | "LONG_ANSWER";
  question: string;
  options?: string[];
}

export interface StudentAssignmentContent {
  title: string;
  instructions: string;
  items: StudentItemContent[];
}

export interface AttemptDetail {
  id: string;
  recipientId: string;
  learnerAccountId: string;
  status: AttemptStatus;
  answers: AttemptAnswer[];
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Distribution context
  aiHelpMode: AiHelpMode;
  deadline: Date | null;
  isGraded: boolean;
  distributionStatus: "MANDATORY" | "PRACTICE";
  // Assignment content (expected answers stripped)
  assignmentContent: StudentAssignmentContent;
}

// Strip expected answers before sending to student
export function toStudentContent(
  items: AssignmentItemContent[]
): StudentItemContent[] {
  return items.map(({ order, type, question, options }) => ({
    order,
    type,
    question,
    ...(options ? { options } : {}),
  }));
}
