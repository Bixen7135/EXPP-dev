/**
 * Text extraction from uploaded material files.
 * Supports:
 * - PDF
 * - Word (DOCX/DOCM and best-effort for DOC)
 * - Excel (XLSX/XLSM/XLSB/XLS)
 * - PowerPoint (PPTX/PPTM and best-effort for PPT)
 * - Plain text formats (TXT/MD/CSV)
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const WORD_OPENXML_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-word.document.macroenabled.12",
]);

const WORD_OPENXML_EXTENSIONS = new Set([".docx", ".docm"]);

const SPREADSHEET_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/vnd.ms-excel.sheet.binary.macroenabled.12",
  "application/vnd.ms-excel",
]);

const SPREADSHEET_EXTENSIONS = new Set([".xlsx", ".xlsm", ".xlsb", ".xls"]);

const PRESENTATION_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint.presentation.macroenabled.12",
  "application/vnd.ms-powerpoint",
]);

const PRESENTATION_EXTENSIONS = new Set([".pptx", ".pptm", ".ppt"]);

const TEXT_MIME_TYPES = new Set(["text/plain", "text/markdown", "text/csv"]);
const TEXT_EXTENSIONS = new Set([".txt", ".md", ".csv"]);

const PDF_WORKER_CANDIDATE_PATHS = [
  path.join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "legacy",
    "build",
    "pdf.worker.mjs"
  ),
  path.join(
    process.cwd(),
    "node_modules",
    "pdf-parse",
    "dist",
    "pdf-parse",
    "cjs",
    "pdf.worker.mjs"
  ),
];

type PdfParseCtor = {
  new (opts: { data: Buffer }): {
    getText: () => Promise<{ text: string }>;
    destroy: () => Promise<unknown>;
  };
  setWorker?: (workerSrc?: string) => string;
};

export async function extractText(
  buffer: Buffer,
  mimeType: string,
  originalFilename = ""
): Promise<string> {
  const normalizedMime = mimeType.toLowerCase();
  const ext = path.extname(originalFilename).toLowerCase();

  if (normalizedMime === "application/pdf" || ext === ".pdf") {
    return extractFromPdf(buffer);
  }

  if (
    WORD_OPENXML_MIME_TYPES.has(normalizedMime) ||
    WORD_OPENXML_EXTENSIONS.has(ext)
  ) {
    return extractFromDocx(buffer);
  }

  if (
    SPREADSHEET_MIME_TYPES.has(normalizedMime) ||
    SPREADSHEET_EXTENSIONS.has(ext)
  ) {
    return extractFromSpreadsheet(buffer);
  }

  if (
    PRESENTATION_MIME_TYPES.has(normalizedMime) ||
    PRESENTATION_EXTENSIONS.has(ext)
  ) {
    return extractFromPresentation(buffer);
  }

  if (TEXT_MIME_TYPES.has(normalizedMime) || TEXT_EXTENSIONS.has(ext)) {
    return buffer.toString("utf-8");
  }

  return extractReadableStrings(buffer);
}

function resolvePdfWorkerSrc(): string | null {
  for (const workerPath of PDF_WORKER_CANDIDATE_PATHS) {
    if (existsSync(workerPath)) {
      return pathToFileURL(workerPath).href;
    }
  }
  return null;
}

async function parsePdfText(
  PDFParse: PdfParseCtor,
  buffer: Buffer,
  workerSrc: string | undefined
): Promise<string> {
  if (typeof PDFParse.setWorker === "function") {
    PDFParse.setWorker(workerSrc);
  }

  const parser = new PDFParse({ data: buffer });

  try {
    const data = await parser.getText();
    return data.text;
  } finally {
    // Best-effort cleanup of PDF.js resources.
    await parser.destroy().catch(() => {});
  }
}

async function extractFromPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const workerSrc = resolvePdfWorkerSrc();

  if (!workerSrc) {
    return parsePdfText(PDFParse, buffer, undefined);
  }

  try {
    return await parsePdfText(PDFParse, buffer, workerSrc);
  } catch (configuredWorkerError) {
    return parsePdfText(PDFParse, buffer, undefined).catch(() => {
      throw configuredWorkerError;
    });
  }
}

async function extractFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");

  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch {
    return extractReadableStrings(buffer);
  }
}

async function extractFromSpreadsheet(buffer: Buffer): Promise<string> {
  const XLSX = await import("xlsx");

  try {
    const workbook = XLSX.read(buffer, { type: "buffer", cellText: true });
    const sheets: string[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false }).trim();
      if (csv.length === 0) continue;

      sheets.push(`Sheet: ${sheetName}\n${csv}`);
    }

    if (sheets.length > 0) {
      return sheets.join("\n\n");
    }
  } catch {
    // Fall back to plain string extraction for unsupported/corrupted workbook variants.
  }

  return extractReadableStrings(buffer);
}

async function extractFromPresentation(buffer: Buffer): Promise<string> {
  const { default: JSZip } = await import("jszip");
  try {
    const zip = await JSZip.loadAsync(buffer);

    const slideFiles = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => slideNumberFromPath(a) - slideNumberFromPath(b));

    const slides: string[] = [];

    for (const slidePath of slideFiles) {
      const xml = await zip.file(slidePath)?.async("text");
      if (!xml) continue;

      const textRuns = extractXmlTextRuns(xml);
      if (textRuns.length === 0) continue;

      const slideNumber = slideNumberFromPath(slidePath);
      slides.push(`Slide ${slideNumber}: ${textRuns.join(" ")}`);
    }

    if (slides.length > 0) {
      return slides.join("\n\n");
    }
  } catch {
    // Legacy PPT files are not ZIP archives.
  }

  return extractReadableStrings(buffer);
}

function slideNumberFromPath(pathname: string): number {
  const match = pathname.match(/slide(\d+)\.xml$/i);
  return match ? Number.parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

function extractXmlTextRuns(xml: string): string[] {
  const matches = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)];

  return matches
    .map((m) => decodeXmlEntities(m[1] ?? "").trim())
    .filter((value) => value.length > 0);
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10))
    );
}

function extractReadableStrings(buffer: Buffer): string {
  const text = buffer.toString("latin1");
  const strings = text.match(/[ -~\u0400-\u04FF]{5,}/g) ?? [];

  const cleaned = strings
    .map((value) => value.trim())
    .filter((value) => /[A-Za-z\u0400-\u04FF]/.test(value));

  return [...new Set(cleaned)].join("\n");
}
