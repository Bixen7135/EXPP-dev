import type { AiHelpMode } from "@/modules/ai-help/mode-definitions";

export type { AiHelpMode };

export type DistributionStatus = "MANDATORY" | "PRACTICE";
export type RecipientStatus = "PENDING" | "ACTIVE" | "SUBMITTED";
export type RecipientSourceType =
  | "FORMAL_ENTITY"
  | "TARGET_GROUP"
  | "PRACTICE_GROUP"
  | "USER";

export interface AssignableStudentSummary {
  id: string;
  name: string;
  email: string;
  domain: "GLOBAL" | "ORGANIZATION";
  organizationId: string | null;
}

export interface RecipientSummary {
  id: string;
  recipientUserId: string;
  recipientDisplayName: string;
  status: RecipientStatus;
  createdAt: Date;
}

export interface DistributionSummary {
  id: string;
  assignmentId: string;
  versionId: string;
  creatorUserId: string;
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
  creatorName: string;
}

export interface RecipientSourceInput {
  sourceType: RecipientSourceType;
  sourceRefId?: string | null;
}

export interface CreateDistributionOpts {
  assignmentId: string;
  versionId: string;
  creatorUserId: string;
  deadline?: Date | null;
  distributionStatus: DistributionStatus;
  isGraded: boolean;
  aiHelpMode: AiHelpMode;
  recipientSources?: RecipientSourceInput[];
  recipientUserIds?: string[];
  includeUserIds?: string[];
  excludeUserIds?: string[];
}
