import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---- Mock dependencies ----

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    material: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    materialFolder: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    rmdir: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/modules/materials/extractor", () => ({
  extractText: vi.fn().mockResolvedValue("extracted text content"),
}));

afterEach(() => { vi.clearAllMocks(); });

import { prisma } from "@/lib/db/prisma";
import { validateFileType, validateFileSize, uploadMaterial, listMaterials, getMaterial, deleteMaterial } from "@/modules/materials/service";
import { ValidationError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { MAX_FILE_SIZE_BINARY, MAX_FILE_SIZE_TEXT } from "@/modules/materials/types";

const mockPrisma = prisma as unknown as {
  material: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  materialFolder: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

describe("validateFileType", () => {
  it("accepts PDF", () => {
    expect(() => validateFileType("lecture.pdf", "application/pdf")).not.toThrow();
  });

  it("accepts DOCX", () => {
    expect(() =>
      validateFileType(
        "notes.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).not.toThrow();
  });

  it("accepts TXT", () => {
    expect(() => validateFileType("readme.txt", "text/plain")).not.toThrow();
  });

  it("accepts MD", () => {
    expect(() => validateFileType("notes.md", "text/markdown")).not.toThrow();
  });

  it("accepts XLSX", () => {
    expect(() =>
      validateFileType(
        "grades.xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )
    ).not.toThrow();
  });

  it("accepts XLS", () => {
    expect(() => validateFileType("grades.xls", "application/vnd.ms-excel")).not.toThrow();
  });

  it("accepts PPTX", () => {
    expect(() =>
      validateFileType(
        "slides.pptx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      )
    ).not.toThrow();
  });

  it("accepts PPT", () => {
    expect(() => validateFileType("slides.ppt", "application/vnd.ms-powerpoint")).not.toThrow();
  });

  it("accepts DOC", () => {
    expect(() => validateFileType("notes.doc", "application/msword")).not.toThrow();
  });

  it("rejects disallowed extension", () => {
    expect(() => validateFileType("script.exe", "application/pdf")).toThrow(ValidationError);
  });

  it("rejects disallowed MIME type even with valid extension", () => {
    expect(() => validateFileType("file.pdf", "image/png")).toThrow(ValidationError);
  });

  it("accepts application/octet-stream when extension is allowed", () => {
    expect(() => validateFileType("notes.md", "application/octet-stream")).not.toThrow();
  });
});

describe("validateFileSize", () => {
  it("accepts PDF within 50 MB", () => {
    expect(() => validateFileSize("application/pdf", 1024)).not.toThrow();
  });

  it("accepts XLSX within 50 MB", () => {
    expect(() =>
      validateFileSize(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        1024
      )
    ).not.toThrow();
  });

  it("rejects PDF over 50 MB", () => {
    expect(() =>
      validateFileSize("application/pdf", MAX_FILE_SIZE_BINARY + 1)
    ).toThrow(ValidationError);
  });

  it("rejects TXT over 10 MB", () => {
    expect(() =>
      validateFileSize("text/plain", MAX_FILE_SIZE_TEXT + 1)
    ).toThrow(ValidationError);
  });

  it("accepts TXT within 10 MB", () => {
    expect(() => validateFileSize("text/plain", 1024)).not.toThrow();
  });

  it("rejects CSV over 10 MB", () => {
    expect(() =>
      validateFileSize("text/csv", MAX_FILE_SIZE_TEXT + 1)
    ).toThrow(ValidationError);
  });
});

describe("uploadMaterial", () => {
  const ownerAccountId = "teacher_01";
  const buffer = Buffer.from("Hello PDF content");

  beforeEach(() => {
    vi.clearAllMocks();

    const fakeMaterial = {
      id: "mat_01",
      ownerAccountId,
      title: "Test Material",
      originalFilename: "test.txt",
      mimeType: "text/plain",
      fileSize: buffer.byteLength,
      storagePath: "",
      extractedText: null,
      status: "PROCESSING",
      createdAt: new Date(),
      updatedAt: new Date(),
      tags: [],
    };

    mockPrisma.material.create.mockResolvedValue(fakeMaterial);
    mockPrisma.material.update.mockResolvedValue({
      ...fakeMaterial,
      storagePath: "/storage/materials/teacher_01/mat_01/test.txt",
      extractedText: "extracted text content",
      status: "READY",
    });
  });

  it("creates a material record and returns READY status", async () => {
    const result = await uploadMaterial({
      ownerAccountId,
      title: "Test Material",
      originalFilename: "test.txt",
      mimeType: "text/plain",
      buffer,
    });

    expect(mockPrisma.material.create).toHaveBeenCalledOnce();
    expect(mockPrisma.material.update).toHaveBeenCalledOnce();
    expect(result.status).toBe("READY");
    expect(result.extractedText).toBe("extracted text content");
  });

  it("throws ValidationError for disallowed file type", async () => {
    await expect(
      uploadMaterial({
        ownerAccountId,
        title: "Bad file",
        originalFilename: "malware.exe",
        mimeType: "application/octet-stream",
        buffer,
      })
    ).rejects.toThrow(ValidationError);

    expect(mockPrisma.material.create).not.toHaveBeenCalled();
  });

  it("normalizes generic MIME type based on extension", async () => {
    await uploadMaterial({
      ownerAccountId,
      title: "Markdown Material",
      originalFilename: "notes.md",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("# title"),
    });

    expect(mockPrisma.material.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mimeType: "text/markdown" }),
      })
    );
  });
});

describe("listMaterials", () => {
  it("returns only the teacher's materials", async () => {
    const rows = [
      { id: "m1", ownerAccountId: "t1", title: "A", originalFilename: "a.pdf", mimeType: "application/pdf", fileSize: 100, storagePath: "", extractedText: null, status: "READY", createdAt: new Date(), updatedAt: new Date(), tags: [] },
    ];
    mockPrisma.material.findMany.mockResolvedValue(rows);

    const result = await listMaterials("t1");
    expect(result).toHaveLength(1);
    expect(mockPrisma.material.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerAccountId: "t1" } })
    );
  });
});

describe("getMaterial", () => {
  it("returns material for the owning teacher", async () => {
    mockPrisma.material.findUnique.mockResolvedValue({
      id: "m1", ownerAccountId: "t1", title: "A", originalFilename: "a.pdf",
      mimeType: "application/pdf", fileSize: 100, storagePath: "/path",
      extractedText: "text", status: "READY", createdAt: new Date(), updatedAt: new Date(), tags: [],
    });

    const result = await getMaterial("m1", "t1");
    expect(result.id).toBe("m1");
  });

  it("throws ForbiddenError when a different teacher requests the material", async () => {
    mockPrisma.material.findUnique.mockResolvedValue({
      id: "m1", ownerAccountId: "t1", title: "A", originalFilename: "a.pdf",
      mimeType: "application/pdf", fileSize: 100, storagePath: "/path",
      extractedText: "text", status: "READY", createdAt: new Date(), updatedAt: new Date(), tags: [],
    });

    await expect(getMaterial("m1", "t2")).rejects.toThrow(ForbiddenError);
  });

  it("throws NotFoundError when material does not exist", async () => {
    mockPrisma.material.findUnique.mockResolvedValue(null);
    await expect(getMaterial("missing", "t1")).rejects.toThrow(NotFoundError);
  });
});

describe("deleteMaterial", () => {
  it("deletes the material for the owning teacher", async () => {
    mockPrisma.material.findUnique.mockResolvedValue({
      id: "m1", ownerAccountId: "t1", storagePath: "/path/file.txt",
    });
    mockPrisma.material.delete.mockResolvedValue({});

    await deleteMaterial("m1", "t1");
    expect(mockPrisma.material.delete).toHaveBeenCalledWith({ where: { id: "m1" } });
  });

  it("throws ForbiddenError when a different teacher tries to delete", async () => {
    mockPrisma.material.findUnique.mockResolvedValue({
      id: "m1", ownerAccountId: "t1", storagePath: "/path/file.txt",
    });

    await expect(deleteMaterial("m1", "t2")).rejects.toThrow(ForbiddenError);
    expect(mockPrisma.material.delete).not.toHaveBeenCalled();
  });
});
