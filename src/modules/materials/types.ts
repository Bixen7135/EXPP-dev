export const ALLOWED_MIME_TYPES = new Set([
  // PDF
  "application/pdf",

  // Word
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-word.document.macroenabled.12",
  "application/msword",

  // Excel
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/vnd.ms-excel.sheet.binary.macroenabled.12",
  "application/vnd.ms-excel",

  // PowerPoint
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint.presentation.macroenabled.12",
  "application/vnd.ms-powerpoint",

  // Text
  "text/plain",
  "text/markdown",
  "text/csv",
]);

export const ALLOWED_EXTENSIONS = new Set([
  ".pdf",

  // Word
  ".docx",
  ".docm",
  ".doc",

  // Excel
  ".xlsx",
  ".xlsm",
  ".xlsb",
  ".xls",
  ".csv",

  // PowerPoint
  ".pptx",
  ".pptm",
  ".ppt",

  // Text
  ".txt",
  ".md",
]);

const TEXT_MIME_TYPES = new Set(["text/plain", "text/markdown", "text/csv"]);

/** 50 MB for binary formats; 10 MB for text formats */
export const MAX_FILE_SIZE_BINARY = 50 * 1024 * 1024;
export const MAX_FILE_SIZE_TEXT = 10 * 1024 * 1024;

export function maxFileSizeFor(mimeType: string): number {
  const normalizedMime = mimeType.toLowerCase();
  return TEXT_MIME_TYPES.has(normalizedMime)
    ? MAX_FILE_SIZE_TEXT
    : MAX_FILE_SIZE_BINARY;
}

export interface MaterialSummary {
  id: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  folderId: string | null;
  folderPath: string | null;
  tags: { key: string; value: string }[];
}

export interface MaterialDetail extends MaterialSummary {
  extractedText: string | null;
  storagePath: string;
}

export interface TagInput {
  key: string;
  value: string;
}

export interface MaterialFolderSummary {
  id: string;
  ownerAccountId: string;
  name: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  path: string;
}
