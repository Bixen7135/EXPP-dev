import type { AiHelpMode } from "@/modules/ai-help/mode-definitions";

export type { AiHelpMode };

export type DistributionStatus = "MANDATORY" | "PRACTICE";
export type RecipientStatus = "PENDING" | "ACTIVE" | "SUBMITTED";

export interface AssignableStudentSummary {
  id: string;
  name: string;
  email: string;
}

export interface RecipientSummary {
  id: string;
  studentId: string;
  status: RecipientStatus;
  createdAt: Date;
}

export interface DistributionSummary {
  id: string;
  assignmentId: string;
  versionId: string;
  teacherId: string;
  deadline: Date | null;
  status: DistributionStatus;
  isGraded: boolean;
  aiHelpMode: AiHelpMode;
  createdAt: Date;
  updatedAt: Date;
}

export interface DistributionDetail extends DistributionSummary {
  recipients: RecipientSummary[];
  assignmentTitle: string;
}

// What the student sees for their assigned work
export interface StudentAssignmentSummary {
  recipientId: string;
  distributionId: string;
  assignmentTitle: string;
  deadline: Date | null;
  distributionStatus: DistributionStatus;
  isGraded: boolean;
  aiHelpMode: AiHelpMode;
  recipientStatus: RecipientStatus;
  attemptStatus: "DRAFT" | "SUBMITTED" | null; // null = not started
  teacherName: string;
}

export interface CreateDistributionOpts {
  assignmentId: string;
  versionId: string;
  teacherId: string;
  deadline?: Date | null;
  distributionStatus: DistributionStatus;
  isGraded: boolean;
  aiHelpMode: AiHelpMode;
  recipientStudentIds: string[];
}
