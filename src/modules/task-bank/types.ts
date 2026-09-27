export interface TaskBankTag {
  key: string;
  value: string;
}

export interface TaskBankRubricCriterion {
  id?: string;
  title?: string;
  description?: string;
  weight?: number;
  type?: "EXPECTATION" | "PENALTY";
}

export interface TaskBankItemContent {
  type: "SHORT_ANSWER" | "MULTIPLE_CHOICE" | "LONG_ANSWER";
  question: string;
  options?: string[];
  expectedAnswer: string;
  maxScore?: number;
  rubricCriteria?: TaskBankRubricCriterion[];
}

export interface TaskBankItemSummary {
  id: string;
  ownerAccountId: string;
  title: string;
  content: TaskBankItemContent;
  tags: TaskBankTag[];
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskBankListFilters {
  search?: string;
  tagKey?: string;
  tagValue?: string;
}

export interface CreateTaskBankItemInput {
  ownerAccountId: string;
  title: string;
  content: TaskBankItemContent;
  tags?: TaskBankTag[];
}

export interface UpdateTaskBankItemInput {
  title?: string;
  content?: TaskBankItemContent;
  tags?: TaskBankTag[];
}
