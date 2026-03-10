import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import * as XLSX from "xlsx";

vi.mock("pdf-parse", () => ({
  PDFParse: Object.assign(vi.fn(), { setWorker: vi.fn() }),
}));

vi.mock("mammoth", () => ({
  extractRawText: vi.fn(),
}));

import { extractText } from "@/modules/materials/extractor";
import { PDFParse } from "pdf-parse";
import { extractRawText } from "mammoth";

describe("materials extractor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts text from PDF via explicit worker setup", async () => {
    const buffer = Buffer.from("fake pdf bytes");
    const parser = {
      getText: vi.fn().mockResolvedValue({ text: "pdf text" }),
      destroy: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(PDFParse).mockImplementation(function MockPDFParse() {
      return parser as unknown as InstanceType<typeof PDFParse>;
    });

    const result = await extractText(buffer, "application/pdf");

    expect(PDFParse.setWorker).toHaveBeenCalledOnce();
    expect(PDFParse.setWorker).toHaveBeenCalledWith(
      expect.stringMatching(/^file:\/\//)
    );
    expect(PDFParse).toHaveBeenCalledWith({ data: buffer });
    expect(parser.getText).toHaveBeenCalledOnce();
    expect(parser.destroy).toHaveBeenCalledOnce();
    expect(result).toBe("pdf text");
  });

  it("retries PDF parsing with default worker when explicit setup fails", async () => {
    const buffer = Buffer.from("fake pdf bytes");
    const firstParser = {
      getText: vi.fn().mockRejectedValue(new Error("worker failed")),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    const secondParser = {
      getText: vi.fn().mockResolvedValue({ text: "pdf text via fallback" }),
      destroy: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(PDFParse)
      .mockImplementationOnce(function FirstParser() {
        return firstParser as unknown as InstanceType<typeof PDFParse>;
      })
      .mockImplementationOnce(function SecondParser() {
        return secondParser as unknown as InstanceType<typeof PDFParse>;
      });

    const result = await extractText(buffer, "application/pdf");

    expect(PDFParse).toHaveBeenCalledTimes(2);
    expect(PDFParse.setWorker).toHaveBeenNthCalledWith(
      1,
      expect.stringMatching(/^file:\/\//)
    );
    expect(PDFParse.setWorker).toHaveBeenNthCalledWith(
      2,
      undefined
    );
    expect(firstParser.destroy).toHaveBeenCalledOnce();
    expect(secondParser.destroy).toHaveBeenCalledOnce();
    expect(result).toBe("pdf text via fallback");
  });

  it("still destroys parser when PDF parsing fails in both attempts", async () => {
    const buffer = Buffer.from("fake pdf bytes");
    const firstParser = {
      getText: vi.fn().mockRejectedValue(new Error("parse failed")),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    const secondParser = {
      getText: vi.fn().mockRejectedValue(new Error("parse failed")),
      destroy: vi.fn().mockResolvedValue(undefined),
    };

    vi.mocked(PDFParse)
      .mockImplementationOnce(function FirstParser() {
        return firstParser as unknown as InstanceType<typeof PDFParse>;
      })
      .mockImplementationOnce(function SecondParser() {
        return secondParser as unknown as InstanceType<typeof PDFParse>;
      });

    await expect(extractText(buffer, "application/pdf")).rejects.toThrow(
      "parse failed"
    );
    expect(firstParser.destroy).toHaveBeenCalledOnce();
    expect(secondParser.destroy).toHaveBeenCalledOnce();
  });

  it("extracts text from DOCX via mammoth", async () => {
    const buffer = Buffer.from("fake docx bytes");
    vi.mocked(extractRawText).mockResolvedValue({ value: "docx text" });

    const result = await extractText(
      buffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    expect(extractRawText).toHaveBeenCalledWith({ buffer });
    expect(result).toBe("docx text");
  });

  it("returns raw text for plain text and markdown", async () => {
    const txt = Buffer.from("plain text content", "utf-8");
    const md = Buffer.from("# heading", "utf-8");

    await expect(extractText(txt, "text/plain")).resolves.toBe(
      "plain text content"
    );
    await expect(extractText(md, "text/markdown")).resolves.toBe("# heading");
  });

  it("extracts text from XLSX sheets", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Topic", "Score"],
      ["Algebra", "95"],
    ]);

    XLSX.utils.book_append_sheet(workbook, sheet, "Grades");
    const buffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer;

    const result = await extractText(
      buffer,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "grades.xlsx"
    );

    expect(result).toContain("Sheet: Grades");
    expect(result).toContain("Topic,Score");
    expect(result).toContain("Algebra,95");
  });

  it("extracts text from PPTX slides", async () => {
    const zip = new JSZip();
    zip.file(
      "ppt/slides/slide1.xml",
      `<?xml version="1.0" encoding="UTF-8"?>
      <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <p:cSld>
          <p:spTree>
            <p:sp>
              <p:txBody>
                <a:p>
                  <a:r><a:t>Presentation Title</a:t></a:r>
                  <a:r><a:t>Second line</a:t></a:r>
                </a:p>
              </p:txBody>
            </p:sp>
          </p:spTree>
        </p:cSld>
      </p:sld>`
    );

    const buffer = Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));

    const result = await extractText(
      buffer,
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "deck.pptx"
    );

    expect(result).toContain("Slide 1: Presentation Title Second line");
  });

  it("falls back safely for legacy PPT binary", async () => {
    const buffer = Buffer.from(
      "PPT legacy content Introduction Agenda Conclusion",
      "latin1"
    );

    const result = await extractText(
      buffer,
      "application/vnd.ms-powerpoint",
      "legacy.ppt"
    );

    expect(result).toContain("PPT legacy content");
  });
});
