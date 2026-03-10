import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db/prisma";
import { extractText } from "./extractor";
import {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  maxFileSizeFor,
  type MaterialSummary,
  type MaterialDetail,
  type MaterialFolderSummary,
  type TagInput,
} from "./types";
import { ValidationError, NotFoundError, ForbiddenError } from "@/lib/errors";

const GENERIC_MIME_TYPES = new Set(["", "application/octet-stream"]);
const MAX_FOLDER_NAME_LENGTH = 120;

const FALLBACK_MIME_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".docm": "application/vnd.ms-word.document.macroenabled.12",
  ".doc": "application/msword",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".xlsm": "application/vnd.ms-excel.sheet.macroenabled.12",
  ".xlsb": "application/vnd.ms-excel.sheet.binary.macroenabled.12",
  ".xls": "application/vnd.ms-excel",
  ".csv": "text/csv",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".pptm": "application/vnd.ms-powerpoint.presentation.macroenabled.12",
  ".ppt": "application/vnd.ms-powerpoint",
  ".txt": "text/plain",
  ".md": "text/markdown",
};

interface MaterialFolderRow {
  id: string;
  teacherId: string;
  name: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MaterialRow {
  id: string;
  teacherId: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  extractedText: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  folderId: string | null;
  tags: { key: string; value: string }[];
}

/** Absolute path to the storage root (outside public/). */
function storageRoot(): string {
  return path.join(process.cwd(), "storage", "materials");
}

function storagePathFor(teacherId: string, materialId: string, filename: string): string {
  return path.join(storageRoot(), teacherId, materialId, filename);
}

/** Sanitise a filename to prevent path traversal. */
function sanitizeFilename(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function normalizeFolderName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (normalized.length === 0) {
    throw new ValidationError("Folder name cannot be empty");
  }
  if (normalized.length > MAX_FOLDER_NAME_LENGTH) {
    throw new ValidationError(
      `Folder name must be at most ${MAX_FOLDER_NAME_LENGTH} characters`
    );
  }
  if (normalized.includes("/")) {
    throw new ValidationError("Folder name cannot include '/'");
  }
  return normalized;
}

function resolveMimeType(originalFilename: string, mimeType: string): string {
  const ext = path.extname(originalFilename).toLowerCase();
  const normalizedMime = mimeType.toLowerCase().trim();

  if (ALLOWED_MIME_TYPES.has(normalizedMime)) {
    return normalizedMime;
  }

  if (GENERIC_MIME_TYPES.has(normalizedMime)) {
    return FALLBACK_MIME_BY_EXTENSION[ext] ?? normalizedMime;
  }

  return normalizedMime;
}

function buildFolderPathMap(rows: MaterialFolderRow[]): Map<string, string> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const memo = new Map<string, string>();

  function resolve(folderId: string, chain: Set<string>): string {
    const cached = memo.get(folderId);
    if (cached) return cached;

    const row = byId.get(folderId);
    if (!row) return "";

    if (chain.has(folderId)) {
      return row.name;
    }

    chain.add(folderId);

    let parentPath = "";
    if (row.parentId) {
      parentPath = resolve(row.parentId, chain);
    }

    chain.delete(folderId);

    const pathValue = parentPath ? `${parentPath}/${row.name}` : row.name;
    memo.set(folderId, pathValue);
    return pathValue;
  }

  rows.forEach((row) => {
    resolve(row.id, new Set<string>());
  });

  return memo;
}

async function listMaterialFolderRows(teacherId: string): Promise<MaterialFolderRow[]> {
  const rows = await prisma.materialFolder.findMany({
    where: { teacherId },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    teacherId: row.teacherId,
    name: row.name,
    parentId: row.parentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

async function assertFolderOwnership(
  folderId: string,
  teacherId: string
): Promise<MaterialFolderRow> {
  const folder = await prisma.materialFolder.findUnique({ where: { id: folderId } });

  if (!folder) {
    throw new NotFoundError("Folder not found");
  }

  if (folder.teacherId !== teacherId) {
    throw new ForbiddenError();
  }

  return {
    id: folder.id,
    teacherId: folder.teacherId,
    name: folder.name,
    parentId: folder.parentId,
    createdAt: folder.createdAt,
    updatedAt: folder.updatedAt,
  };
}

export function validateFileType(
  originalFilename: string,
  mimeType: string
): void {
  const ext = path.extname(originalFilename).toLowerCase();
  const resolvedMime = resolveMimeType(originalFilename, mimeType);

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new ValidationError(
      `File type not allowed. Supported: ${[...ALLOWED_EXTENSIONS].join(", ")}`
    );
  }
  if (!ALLOWED_MIME_TYPES.has(resolvedMime)) {
    throw new ValidationError(`MIME type not allowed: ${mimeType}`);
  }
}

export function validateFileSize(mimeType: string, size: number): void {
  const max = maxFileSizeFor(mimeType);
  if (size > max) {
    const maxMb = Math.round(max / 1024 / 1024);
    throw new ValidationError(`File too large. Maximum size: ${maxMb} MB`);
  }
}

export async function listMaterialFolders(
  teacherId: string
): Promise<MaterialFolderSummary[]> {
  const rows = await listMaterialFolderRows(teacherId);
  const pathMap = buildFolderPathMap(rows);

  return rows
    .map((row) => ({
      id: row.id,
      teacherId: row.teacherId,
      name: row.name,
      parentId: row.parentId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      path: pathMap.get(row.id) ?? row.name,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export async function createMaterialFolder(opts: {
  teacherId: string;
  name: string;
  parentId?: string | null;
}): Promise<MaterialFolderSummary> {
  const teacherId = opts.teacherId;
  const normalizedName = normalizeFolderName(opts.name);
  const parentId = opts.parentId ?? null;

  if (parentId) {
    await assertFolderOwnership(parentId, teacherId);
  }

  const duplicate = await prisma.materialFolder.findFirst({
    where: {
      teacherId,
      parentId,
      name: { equals: normalizedName, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new ValidationError("A folder with this name already exists here");
  }

  const created = await prisma.materialFolder.create({
    data: {
      teacherId,
      name: normalizedName,
      parentId,
    },
  });

  const folders = await listMaterialFolderRows(teacherId);
  const pathMap = buildFolderPathMap(folders);

  return {
    id: created.id,
    teacherId: created.teacherId,
    name: created.name,
    parentId: created.parentId,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
    path: pathMap.get(created.id) ?? created.name,
  };
}

export async function deleteMaterialFolder(
  folderId: string,
  teacherId: string
): Promise<void> {
  await assertFolderOwnership(folderId, teacherId);
  await prisma.materialFolder.delete({ where: { id: folderId } });
}

export async function renameMaterialFolder(opts: {
  folderId: string;
  teacherId: string;
  name: string;
}): Promise<MaterialFolderSummary> {
  const { folderId, teacherId, name } = opts;
  const folder = await assertFolderOwnership(folderId, teacherId);
  const normalizedName = normalizeFolderName(name);

  const currentName = folder.name.trim();
  if (currentName.toLowerCase() !== normalizedName.toLowerCase()) {
    const duplicate = await prisma.materialFolder.findFirst({
      where: {
        teacherId,
        parentId: folder.parentId,
        name: { equals: normalizedName, mode: "insensitive" },
        NOT: { id: folderId },
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new ValidationError("A folder with this name already exists here");
    }
  }

  const updated = await prisma.materialFolder.update({
    where: { id: folderId },
    data: { name: normalizedName },
  });

  const folders = await listMaterialFolderRows(teacherId);
  const pathMap = buildFolderPathMap(folders);

  return {
    id: updated.id,
    teacherId: updated.teacherId,
    name: updated.name,
    parentId: updated.parentId,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    path: pathMap.get(updated.id) ?? updated.name,
  };
}

export async function moveMaterialFolder(opts: {
  folderId: string;
  teacherId: string;
  parentId: string | null;
}): Promise<MaterialFolderSummary> {
  const { folderId, teacherId, parentId } = opts;
  const folder = await assertFolderOwnership(folderId, teacherId);

  if ((folder.parentId ?? null) === parentId) {
    const folders = await listMaterialFolderRows(teacherId);
    const pathMap = buildFolderPathMap(folders);
    return {
      id: folder.id,
      teacherId: folder.teacherId,
      name: folder.name,
      parentId: folder.parentId,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt,
      path: pathMap.get(folder.id) ?? folder.name,
    };
  }

  if (parentId === folderId) {
    throw new ValidationError("A folder cannot be moved into itself");
  }

  if (parentId) {
    await assertFolderOwnership(parentId, teacherId);
  }

  const allFolders = await listMaterialFolderRows(teacherId);
  const byId = new Map(allFolders.map((row) => [row.id, row]));

  let cursor = parentId;
  while (cursor) {
    if (cursor === folderId) {
      throw new ValidationError("A folder cannot be moved into its own subfolder");
    }
    cursor = byId.get(cursor)?.parentId ?? null;
  }

  const duplicate = await prisma.materialFolder.findFirst({
    where: {
      teacherId,
      parentId,
      name: { equals: folder.name, mode: "insensitive" },
      NOT: { id: folderId },
    },
    select: { id: true },
  });

  if (duplicate) {
    throw new ValidationError("A folder with this name already exists here");
  }

  const updated = await prisma.materialFolder.update({
    where: { id: folderId },
    data: { parentId },
  });

  const refreshedFolders = await listMaterialFolderRows(teacherId);
  const pathMap = buildFolderPathMap(refreshedFolders);

  return {
    id: updated.id,
    teacherId: updated.teacherId,
    name: updated.name,
    parentId: updated.parentId,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
    path: pathMap.get(updated.id) ?? updated.name,
  };
}

export async function uploadMaterial(opts: {
  teacherId: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  buffer: Buffer;
  folderId?: string | null;
  tags?: TagInput[];
}): Promise<MaterialDetail> {
  const {
    teacherId,
    title,
    originalFilename,
    mimeType,
    buffer,
    folderId,
    tags = [],
  } = opts;
  const resolvedMime = resolveMimeType(originalFilename, mimeType);

  validateFileType(originalFilename, resolvedMime);
  validateFileSize(resolvedMime, buffer.byteLength);

  let targetFolderId: string | null = null;
  if (folderId) {
    const folder = await assertFolderOwnership(folderId, teacherId);
    targetFolderId = folder.id;
  }

  const safeFilename = sanitizeFilename(originalFilename);

  // Create DB record first to get the ID for the storage path
  const material = await prisma.material.create({
    data: {
      teacherId,
      folderId: targetFolderId,
      title,
      originalFilename: safeFilename,
      mimeType: resolvedMime,
      fileSize: buffer.byteLength,
      storagePath: "", // updated after file write
      status: "PROCESSING",
      tags: {
        create: tags.map(({ key, value }) => ({ key, value })),
      },
    },
    include: { tags: true },
  });

  const filePath = storagePathFor(teacherId, material.id, safeFilename);

  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);

    // Extract text
    const extractedText = await extractText(buffer, resolvedMime, safeFilename);

    const updated = await prisma.material.update({
      where: { id: material.id },
      data: {
        storagePath: filePath,
        extractedText,
        status: "READY",
      },
      include: { tags: true },
    });

    let folderPath: string | null = null;
    if (targetFolderId) {
      const folders = await listMaterialFolderRows(teacherId);
      const pathMap = buildFolderPathMap(folders);
      folderPath = pathMap.get(targetFolderId) ?? null;
    }

    return toDetail(updated as MaterialRow, folderPath);
  } catch (err) {
    // Mark as ERROR; don't delete the record so the teacher can see failure
    await prisma.material.update({
      where: { id: material.id },
      data: { status: "ERROR", storagePath: filePath },
    });
    throw err;
  }
}

export async function listMaterials(teacherId: string): Promise<MaterialSummary[]> {
  const [rows, folders] = await Promise.all([
    prisma.material.findMany({
      where: { teacherId },
      orderBy: { updatedAt: "desc" },
      include: { tags: true },
    }),
    listMaterialFolderRows(teacherId),
  ]);

  const pathMap = buildFolderPathMap(folders);

  return rows.map((row) => toSummary(row as MaterialRow, pathMap.get(row.folderId ?? "") ?? null));
}

export async function getMaterial(
  id: string,
  teacherId: string
): Promise<MaterialDetail> {
  const material = await prisma.material.findUnique({
    where: { id },
    include: { tags: true },
  });

  if (!material) throw new NotFoundError("Material not found");
  if (material.teacherId !== teacherId) throw new ForbiddenError();

  const folders = await listMaterialFolderRows(teacherId);
  const pathMap = buildFolderPathMap(folders);

  return toDetail(
    material as MaterialRow,
    pathMap.get(material.folderId ?? "") ?? null
  );
}

export async function deleteMaterial(
  id: string,
  teacherId: string
): Promise<void> {
  const material = await prisma.material.findUnique({ where: { id } });
  if (!material) throw new NotFoundError("Material not found");
  if (material.teacherId !== teacherId) throw new ForbiddenError();

  // Delete file from disk (best-effort)
  if (material.storagePath) {
    try {
      await fs.unlink(material.storagePath);
      // Remove directory if empty
      await fs.rmdir(path.dirname(material.storagePath)).catch(() => {});
    } catch {
      // File may not exist; proceed with DB deletion
    }
  }

  await prisma.material.delete({ where: { id } });
}

export async function moveMaterialToFolder(opts: {
  materialId: string;
  teacherId: string;
  folderId: string | null;
}): Promise<MaterialDetail> {
  const { materialId, teacherId, folderId } = opts;

  const material = await prisma.material.findUnique({
    where: { id: materialId },
    include: { tags: true },
  });

  if (!material) throw new NotFoundError("Material not found");
  if (material.teacherId !== teacherId) throw new ForbiddenError();

  let targetFolderId: string | null = null;
  if (folderId) {
    const folder = await assertFolderOwnership(folderId, teacherId);
    targetFolderId = folder.id;
  }

  const updated = await prisma.material.update({
    where: { id: materialId },
    data: { folderId: targetFolderId },
    include: { tags: true },
  });

  const folders = await listMaterialFolderRows(teacherId);
  const pathMap = buildFolderPathMap(folders);

  return toDetail(
    updated as MaterialRow,
    pathMap.get(updated.folderId ?? "") ?? null
  );
}

function toSummary(m: MaterialRow, folderPath: string | null): MaterialSummary {
  return {
    id: m.id,
    title: m.title,
    originalFilename: m.originalFilename,
    mimeType: m.mimeType,
    fileSize: m.fileSize,
    status: m.status,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    folderId: m.folderId,
    folderPath,
    tags: m.tags.map(({ key, value }) => ({ key, value })),
  };
}

function toDetail(m: MaterialRow, folderPath: string | null): MaterialDetail {
  return {
    ...toSummary(m, folderPath),
    extractedText: m.extractedText ?? null,
    storagePath: m.storagePath,
  };
}
