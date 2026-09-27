"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

interface Tag {
  key: string;
  value: string;
}

interface MaterialSummary {
  id: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  folderId: string | null;
  folderPath: string | null;
  tags: Tag[];
}

interface MaterialFolderSummary {
  id: string;
  ownerAccountId: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  path: string;
}

type BufferStatus = "BUFFERED" | "UPLOADING" | "ERROR";
type SortField = "updatedAt" | "fileSize" | "title" | "fileType";
type SortDirection = "asc" | "desc";
const ROOT_DROP_KEY = "__ROOT__";

interface BufferedMaterial {
  id: string;
  file: File;
  title: string;
  status: BufferStatus;
  error: string | null;
  folderId: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function titleFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, "").trim();
  const fallback = withoutExt.length > 0 ? withoutExt : filename.trim();
  return (fallback || "Untitled material").slice(0, 200);
}

function fileTypeLabel(filename: string, mimeType: string): string {
  const ext = filename.split(".").pop();
  if (ext && ext !== filename) return ext.toUpperCase();

  const slash = mimeType.indexOf("/");
  if (slash === -1) return mimeType;

  return mimeType.slice(slash + 1).toUpperCase();
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    READY: "bg-emerald-500/15 text-emerald-300",
    PROCESSING: "bg-[color:var(--color-blue-500)]/10 text-[color:var(--color-blue-200)]",
    ERROR: "bg-red-500/15 text-red-300",
  };

  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status] ?? "bg-slate-800/70 text-slate-200"}`}
    >
      {status}
    </span>
  );
}

function BufferStatusBadge({ status }: { status: BufferStatus }) {
  const colors: Record<BufferStatus, string> = {
    BUFFERED: "bg-[color:var(--color-blue-500)]/15 text-[color:var(--color-blue-200)]",
    UPLOADING: "bg-[color:var(--color-blue-500)]/10 text-[color:var(--color-blue-200)]",
    ERROR: "bg-red-500/15 text-red-300",
  };

  const labels: Record<BufferStatus, string> = {
    BUFFERED: "Buffered",
    UPLOADING: "Uploading",
    ERROR: "Error",
  };

  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<MaterialSummary[]>([]);
  const [folders, setFolders] = useState<MaterialFolderSummary[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [uploading, setUploading] = useState(false);
  const [bufferedMaterials, setBufferedMaterials] = useState<BufferedMaterial[]>(
    []
  );
  const [bufferError, setBufferError] = useState<string | null>(null);
  const [bufferInfo, setBufferInfo] = useState<string | null>(null);
  const [bufferBulkFolderId, setBufferBulkFolderId] = useState<string>("");

  const [newFolderName, setNewFolderName] = useState("");
  const [showCreateFolderForm, setShowCreateFolderForm] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [deleteFolderConfirmId, setDeleteFolderConfirmId] = useState<string | null>(null);
  const [deleteMaterialConfirmId, setDeleteMaterialConfirmId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>([]);
  const [lastSelectedMaterialId, setLastSelectedMaterialId] = useState<string | null>(null);
  const [movingMaterialIds, setMovingMaterialIds] = useState<string[]>([]);
  const [movingFolderId, setMovingFolderId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [draggedMaterialIds, setDraggedMaterialIds] = useState<string[]>([]);
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const folderMap = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders]
  );

  const breadcrumbs = useMemo(() => {
    const trail: MaterialFolderSummary[] = [];
    const visited = new Set<string>();

    let cursor = currentFolderId;
    while (cursor) {
      if (visited.has(cursor)) break;
      visited.add(cursor);

      const folder = folderMap.get(cursor);
      if (!folder) break;

      trail.push(folder);
      cursor = folder.parentId;
    }

    return trail.reverse();
  }, [currentFolderId, folderMap]);

  const currentFolderPath =
    breadcrumbs.length > 0 ? breadcrumbs.map((crumb) => crumb.name).join("/") : "Root";
  const explorerPath = useMemo(
    () => [
      { id: null as string | null, label: "Materials" },
      ...breadcrumbs.map((crumb) => ({ id: crumb.id, label: crumb.name })),
    ],
    [breadcrumbs]
  );

  const childFolders = useMemo(
    () =>
      folders
        .filter((folder) => folder.parentId === currentFolderId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [folders, currentFolderId]
  );

  const materialsInCurrentFolder = useMemo(
    () =>
      materials.filter((material) => (material.folderId ?? null) === currentFolderId),
    [materials, currentFolderId]
  );

  const sortedMaterials = useMemo(() => {
    const list = [...materialsInCurrentFolder];

    const compare = (a: MaterialSummary, b: MaterialSummary): number => {
      if (sortField === "updatedAt") {
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }

      if (sortField === "fileSize") {
        return a.fileSize - b.fileSize;
      }

      if (sortField === "fileType") {
        return fileTypeLabel(a.originalFilename, a.mimeType).localeCompare(
          fileTypeLabel(b.originalFilename, b.mimeType)
        );
      }

      return a.title.localeCompare(b.title);
    };

    list.sort((a, b) => {
      const primary = compare(a, b);
      if (primary !== 0) {
        return sortDirection === "asc" ? primary : -primary;
      }

      const fallback = a.title.localeCompare(b.title);
      return sortDirection === "asc" ? fallback : -fallback;
    });

    return list;
  }, [materialsInCurrentFolder, sortDirection, sortField]);

  const selectedMaterialSet = useMemo(
    () => new Set(selectedMaterialIds),
    [selectedMaterialIds]
  );
  const movingMaterialSet = useMemo(
    () => new Set(movingMaterialIds),
    [movingMaterialIds]
  );
  const draggedMaterialSet = useMemo(
    () => new Set(draggedMaterialIds),
    [draggedMaterialIds]
  );

  const bufferedCount = bufferedMaterials.length;
  const failedBufferedCount = bufferedMaterials.filter((m) => m.status === "ERROR").length;
  const uploadButtonLabel = uploading
    ? "Uploading..."
    : bufferedCount === 0
      ? "Upload buffered files"
      : `Upload ${bufferedCount} buffered file${bufferedCount === 1 ? "" : "s"}`;

  async function fetchMaterials() {
    const res = await fetch("/api/materials");
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || "Failed to load materials");
    }
    setMaterials(json.data);
  }

  async function fetchFolders() {
    const res = await fetch("/api/materials/folders");
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.error || "Failed to load folders");
    }
    setFolders(json.data);
  }

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        await Promise.all([fetchMaterials(), fetchFolders()]);
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : "Failed to load materials");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!currentFolderId) return;
    if (!folderMap.has(currentFolderId)) {
      setCurrentFolderId(null);
    }
  }, [currentFolderId, folderMap]);

  async function uploadMaterialToPlatform(
    file: File,
    title: string,
    folderId: string | null
  ): Promise<void> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    if (folderId) {
      formData.append("folderId", folderId);
    }

    const res = await fetch("/api/materials", { method: "POST", body: formData });

    let json: { success?: boolean; error?: string } | null = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok || !json?.success) {
      throw new Error(json?.error || "Upload failed");
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function resolveFolderPath(folderId: string | null): string {
    if (!folderId) return "Root";
    return folderMap.get(folderId)?.path ?? "Root";
  }

  function handleBufferFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setBufferError(null);
    setBufferInfo(null);

    const nextItems: BufferedMaterial[] = files.map((file) => ({
      id: `${file.name}-${file.lastModified}-${file.size}-${crypto.randomUUID()}`,
      file,
      title: titleFromFilename(file.name),
      status: "BUFFERED",
      error: null,
      folderId: currentFolderId,
    }));

    setBufferedMaterials((prev) => [...prev, ...nextItems]);
    e.target.value = "";
  }

  function handleBufferedTitleChange(id: string, title: string) {
    setBufferedMaterials((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title, error: null } : item))
    );
  }

  function handleBufferedFolderChange(id: string, folderId: string | null) {
    setBufferedMaterials((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, folderId, error: null } : item
      )
    );
  }

  function handleBulkBufferedFolderChange(folderIdValue: string) {
    setBufferBulkFolderId(folderIdValue);
    const nextFolderId = folderIdValue || null;
    setBufferedMaterials((prev) =>
      prev.map((item) => ({ ...item, folderId: nextFolderId, error: null }))
    );
  }

  function handleRemoveBuffered(id: string) {
    setBufferedMaterials((prev) => prev.filter((item) => item.id !== id));
  }

  function handleClearBuffer() {
    setBufferedMaterials([]);
    setBufferError(null);
    setBufferInfo(null);
    setBufferBulkFolderId("");
  }

  async function handleFinalizeUpload() {
    setBufferError(null);
    setBufferInfo(null);

    if (bufferedMaterials.length === 0) {
      setBufferError("Select one or more files first.");
      return;
    }

    setUploading(true);
    const queue = bufferedMaterials.map((item) => ({
      ...item,
      title: item.title.trim() || titleFromFilename(item.file.name),
      folderId: item.folderId && folderMap.has(item.folderId) ? item.folderId : null,
    }));

    let uploadedCount = 0;

    try {
      for (const item of queue) {
        setBufferedMaterials((prev) =>
          prev.map((m) =>
            m.id === item.id
              ? { ...m, title: item.title, status: "UPLOADING", error: null }
              : m
          )
        );

        try {
          await uploadMaterialToPlatform(item.file, item.title, item.folderId);
          uploadedCount += 1;
          setBufferedMaterials((prev) => prev.filter((m) => m.id !== item.id));
        } catch (e) {
          const message = e instanceof Error ? e.message : "Upload failed";
          setBufferedMaterials((prev) =>
            prev.map((m) =>
              m.id === item.id ? { ...m, status: "ERROR", error: message } : m
            )
          );
        }
      }

      await fetchMaterials();
    } finally {
      setUploading(false);
    }

    const failedCount = queue.length - uploadedCount;
    if (uploadedCount > 0 && failedCount === 0) {
      setBufferInfo(`Uploaded ${uploadedCount} material${uploadedCount === 1 ? "" : "s"}.`);
      return;
    }

    if (uploadedCount > 0) {
      setBufferInfo(
        `Uploaded ${uploadedCount} material${uploadedCount === 1 ? "" : "s"}, ${failedCount} failed.`
      );
      return;
    }

    setBufferError("No files were uploaded. Fix errors and try again.");
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) {
      setFolderError("Folder name is required");
      return;
    }

    setCreatingFolder(true);
    setFolderError(null);

    try {
      const res = await fetch("/api/materials/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: currentFolderId }),
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.error || "Failed to create folder");
      }

      setFolders((prev) => [...prev, json.data]);
      setNewFolderName("");
      setShowCreateFolderForm(false);
    } catch (e) {
      setFolderError(e instanceof Error ? e.message : "Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleCreateFolderSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await handleCreateFolder();
  }

  function handleOpenCreateFolderForm() {
    if (showCreateFolderForm) {
      handleCancelCreateFolderForm();
      return;
    }
    setFolderError(null);
    setShowCreateFolderForm(true);
  }

  function handleCancelCreateFolderForm() {
    setNewFolderName("");
    setFolderError(null);
    setShowCreateFolderForm(false);
  }

  async function handleMoveMaterials(materialIds: string[], nextFolderId: string | null) {
    const targetIds = [...new Set(materialIds)].filter((id) => {
      const material = materials.find((item) => item.id === id);
      return material && (material.folderId ?? null) !== nextFolderId;
    });

    if (targetIds.length === 0) return;

    setMoveError(null);
    setMovingMaterialIds(targetIds);

    try {
      const movedMaterials = await Promise.all(
        targetIds.map(async (materialId) => {
          const res = await fetch(`/api/materials/${materialId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderId: nextFolderId }),
          });

          const json = await res.json();
          if (!json.success) {
            throw new Error(json.error || "Failed to move material");
          }
          return json.data as MaterialSummary;
        })
      );

      const movedById = new Map(movedMaterials.map((item) => [item.id, item]));
      setMaterials((prev) =>
        prev.map((item) => movedById.get(item.id) ?? item)
      );
      setSelectedMaterialIds((prev) => prev.filter((id) => !targetIds.includes(id)));
      setLastSelectedMaterialId((prev) =>
        prev && targetIds.includes(prev) ? null : prev
      );
    } catch (e) {
      setMoveError(e instanceof Error ? e.message : "Failed to move material");
    } finally {
      setMovingMaterialIds([]);
      setDraggedMaterialIds([]);
      setDropTargetKey(null);
    }
  }

  async function handleMoveFolder(folderId: string, nextParentId: string | null) {
    if (folderId === nextParentId) return;

    setFolderError(null);
    setMovingFolderId(folderId);

    try {
      const res = await fetch(`/api/materials/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: nextParentId }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to move folder");

      await Promise.all([fetchFolders(), fetchMaterials()]);
    } catch (e) {
      setFolderError(e instanceof Error ? e.message : "Failed to move folder");
    } finally {
      setMovingFolderId(null);
      setDraggedFolderId(null);
      setDropTargetKey(null);
    }
  }

  function folderDropKey(folderId: string | null): string {
    return folderId ?? ROOT_DROP_KEY;
  }

  function handleMaterialRowClick(
    e: React.MouseEvent<HTMLTableRowElement>,
    materialId: string
  ) {
    if (movingMaterialSet.has(materialId) || movingFolderId !== null) return;

    const visibleIds = sortedMaterials.map((item) => item.id);

    if (e.shiftKey && lastSelectedMaterialId) {
      const anchor = visibleIds.indexOf(lastSelectedMaterialId);
      const current = visibleIds.indexOf(materialId);
      if (anchor !== -1 && current !== -1) {
        const [from, to] = anchor < current ? [anchor, current] : [current, anchor];
        const range = visibleIds.slice(from, to + 1);
        setSelectedMaterialIds((prev) => [...new Set([...prev, ...range])]);
        return;
      }
    }

    if (e.ctrlKey || e.metaKey) {
      setSelectedMaterialIds((prev) =>
        prev.includes(materialId)
          ? prev.filter((id) => id !== materialId)
          : [...prev, materialId]
      );
      setLastSelectedMaterialId(materialId);
      return;
    }

    setSelectedMaterialIds([materialId]);
    setLastSelectedMaterialId(materialId);
  }

  function handleMaterialDragStart(
    e: React.DragEvent<HTMLTableRowElement>,
    materialId: string
  ) {
    if (movingMaterialIds.length > 0 || movingFolderId !== null) {
      e.preventDefault();
      return;
    }

    const idsToDrag = selectedMaterialSet.has(materialId)
      ? selectedMaterialIds
      : [materialId];

    if (!selectedMaterialSet.has(materialId)) {
      setSelectedMaterialIds([materialId]);
      setLastSelectedMaterialId(materialId);
    }

    setMoveError(null);
    setDraggedFolderId(null);
    setDraggedMaterialIds(idsToDrag);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/json", JSON.stringify(idsToDrag));
  }

  function handleFolderRowDragStart(
    e: React.DragEvent<HTMLTableRowElement>,
    folderId: string
  ) {
    if (movingFolderId !== null || movingMaterialIds.length > 0) {
      e.preventDefault();
      return;
    }

    setMoveError(null);
    setFolderError(null);
    setDraggedMaterialIds([]);
    setDraggedFolderId(folderId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-material-folder-id", folderId);
  }

  function handleFolderRowDragEnd() {
    setDraggedFolderId(null);
    setDropTargetKey(null);
  }

  function handleMaterialDragEnd() {
    setDraggedMaterialIds([]);
    setDropTargetKey(null);
  }

  function handleFolderDragOver(
    e: React.DragEvent<HTMLElement>,
    targetFolderId: string | null
  ) {
    const hasMaterialDrag = draggedMaterialIds.length > 0;
    const hasFolderDrag = draggedFolderId !== null;
    if (!hasMaterialDrag && !hasFolderDrag) return;

    if (hasFolderDrag && draggedFolderId === targetFolderId) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetKey(folderDropKey(targetFolderId));
  }

  async function handleFolderDrop(
    e: React.DragEvent<HTMLElement>,
    targetFolderId: string | null
  ) {
    e.preventDefault();
    setDropTargetKey(null);

    const draggedFolder =
      draggedFolderId || e.dataTransfer.getData("application/x-material-folder-id");
    if (draggedFolder) {
      setDraggedFolderId(null);
      if (draggedFolder === targetFolderId) return;
      await handleMoveFolder(draggedFolder, targetFolderId);
      return;
    }

    let materialIds = draggedMaterialIds;
    if (materialIds.length === 0) {
      const payload = e.dataTransfer.getData("application/json");
      if (!payload) return;
      try {
        const parsed = JSON.parse(payload) as unknown;
        if (!Array.isArray(parsed)) return;
        materialIds = parsed.filter((id): id is string => typeof id === "string");
      } catch {
        return;
      }
    }

    if (materialIds.length === 0) return;
    await handleMoveMaterials(materialIds, targetFolderId);
  }

  async function handleDelete(id: string, title: string) {
    setError(null);
    try {
      const res = await fetch(`/api/materials/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
      setSelectedMaterialIds((prev) => prev.filter((itemId) => itemId !== id));
      setLastSelectedMaterialId((prev) => (prev === id ? null : prev));
      setDeleteMaterialConfirmId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : `Could not delete "${title}".`);
    }
  }

  function startFolderRename(folder: MaterialFolderSummary) {
    setFolderError(null);
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  }

  function cancelFolderRename() {
    setEditingFolderId(null);
    setEditingFolderName("");
  }

  async function submitFolderRename(folder: MaterialFolderSummary) {
    const name = editingFolderName.trim();
    if (!name) {
      setFolderError("Folder name is required");
      return;
    }

    if (name.toLowerCase() === folder.name.trim().toLowerCase()) {
      cancelFolderRename();
      return;
    }

    setFolderError(null);
    setRenamingFolderId(folder.id);

    try {
      const res = await fetch(`/api/materials/folders/${folder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to rename folder");

      await Promise.all([fetchFolders(), fetchMaterials()]);
      cancelFolderRename();
    } catch (e) {
      setFolderError(e instanceof Error ? e.message : "Failed to rename folder");
    } finally {
      setRenamingFolderId(null);
    }
  }

  async function handleDeleteFolder(folder: MaterialFolderSummary) {
    if (editingFolderId === folder.id) {
      cancelFolderRename();
    }
    setFolderError(null);
    setDeletingFolderId(folder.id);

    try {
      const res = await fetch(`/api/materials/folders/${folder.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to delete folder");

      await Promise.all([fetchFolders(), fetchMaterials()]);
      setDeleteFolderConfirmId(null);
    } catch (e) {
      setFolderError(e instanceof Error ? e.message : "Failed to delete folder");
    } finally {
      setDeletingFolderId(null);
    }
  }

  function openFolder(folderId: string | null) {
    setSelectedMaterialIds([]);
    setLastSelectedMaterialId(null);
    setDraggedMaterialIds([]);
    setDraggedFolderId(null);
    setCurrentFolderId(folderId);
  }

  return (
    <main className="p-8 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Materials</h1>

      <section className="p-5 border rounded-lg bg-slate-900/60 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Upload destination</p>
            <p className="text-sm text-slate-400">{currentFolderPath}</p>
          </div>
          <button
            type="button"
            onClick={openFilePicker}
            className="px-4 py-2 workspace-primary-action text-white rounded text-sm font-medium "
          >
            Select Files
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={[
            ".pdf,.doc,.docx,.docm,.xls,.xlsx,.xlsm,.xlsb,.csv,.ppt,.pptx,.pptm,.txt,.md",
            "application/pdf,application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-word.document.macroenabled.12",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel.sheet.macroenabled.12",
            "application/vnd.ms-excel.sheet.binary.macroenabled.12",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/vnd.ms-powerpoint.presentation.macroenabled.12",
            "text/plain,text/markdown,text/csv",
          ].join(",")}
          multiple
          onChange={handleBufferFiles}
          className="sr-only"
        />

        {bufferedCount > 0 ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-400">Folder for all buffered:</span>
              <select
                value={bufferBulkFolderId}
                onChange={(e) => handleBulkBufferedFolderChange(e.target.value)}
                disabled={uploading}
                className="border rounded px-2 py-1 text-sm disabled:opacity-50"
              >
                <option value="">Root</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.path}
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto border rounded bg-slate-900">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left text-slate-400">
                    <th className="py-2 px-3">Title</th>
                    <th className="py-2 px-3">File</th>
                    <th className="py-2 px-3">Destination Folder</th>
                    <th className="py-2 px-3">Size</th>
                    <th className="py-2 px-3">Stage</th>
                    <th className="py-2 px-3" />
                  </tr>
                </thead>
                <tbody>
                  {bufferedMaterials.map((item) => (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="py-2 px-3 min-w-[220px]">
                        <input
                          type="text"
                          maxLength={200}
                          value={item.title}
                          aria-label={`Title for ${item.file.name}`}
                          disabled={uploading || item.status === "UPLOADING"}
                          onChange={(e) => handleBufferedTitleChange(item.id, e.target.value)}
                          className="w-full border rounded px-2 py-1"
                        />
                      </td>
                      <td className="py-2 px-3 text-slate-300">{item.file.name}</td>
                      <td className="py-2 px-3 text-slate-400 min-w-[240px]">
                        <select
                          value={item.folderId && folderMap.has(item.folderId) ? item.folderId : ""}
                          onChange={(e) =>
                            handleBufferedFolderChange(item.id, e.target.value || null)
                          }
                          disabled={uploading || item.status === "UPLOADING"}
                          className="w-full border rounded px-2 py-1 text-sm disabled:opacity-50"
                          aria-label={`Destination folder for ${item.file.name}`}
                        >
                          <option value="">Root</option>
                          {folders.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.path}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-slate-400">
                          Current: {resolveFolderPath(item.folderId)}
                        </p>
                      </td>
                      <td className="py-2 px-3 text-slate-300">{formatBytes(item.file.size)}</td>
                      <td className="py-2 px-3">
                        <BufferStatusBadge status={item.status} />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveBuffered(item.id)}
                          disabled={uploading || item.status === "UPLOADING"}
                          className="text-xs text-red-400 hover:underline disabled:opacity-50"
                        >
                          Remove
                        </button>
                        {item.error && (
                          <p className="text-red-400 text-xs mt-1 text-left">{item.error}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No files buffered.</p>
        )}

        <div aria-live="polite" className="space-y-1">
          {bufferError && <p className="text-red-400 text-sm">{bufferError}</p>}
          {bufferInfo && <p className="text-emerald-300 text-sm">{bufferInfo}</p>}
          {failedBufferedCount > 0 && (
            <p className="text-[color:var(--color-blue-200)] text-sm">
              {failedBufferedCount} file{failedBufferedCount === 1 ? "" : "s"} failed.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleFinalizeUpload}
            disabled={uploading || bufferedCount === 0}
            className="px-4 py-2 workspace-primary-action text-white rounded text-sm font-medium  disabled:opacity-50"
          >
            {uploadButtonLabel}
          </button>
          <button
            type="button"
            onClick={handleClearBuffer}
            disabled={uploading || bufferedCount === 0}
            className="px-4 py-2 bg-slate-900 border rounded text-sm font-medium hover:bg-slate-800/70 disabled:opacity-50"
          >
            Clear Buffer
          </button>
        </div>
      </section>

      <section className="p-5 border rounded-lg space-y-4">
        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full items-center gap-1 rounded-xl border bg-slate-900 px-2 py-1.5 text-sm text-slate-300">
            {explorerPath.map((node, index) => {
              const key = node.id ?? ROOT_DROP_KEY;
              const isCurrent = (node.id ?? null) === currentFolderId;
              const isDropTarget = dropTargetKey === folderDropKey(node.id);

              return (
                <div key={key} className="flex items-center gap-1">
                  {index > 0 && (
                    <span className="text-slate-500" aria-hidden="true">
                      <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
                        <path
                          d="M6 3.5L10 8l-4 4.5"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => openFolder(node.id)}
                    onDragOver={(e) => handleFolderDragOver(e, node.id)}
                    onDrop={(e) => void handleFolderDrop(e, node.id)}
                    className={`rounded-md px-3 py-1.5 whitespace-nowrap transition-colors ${
                      isDropTarget
                        ? "bg-[color:var(--color-blue-500)]/20 text-[color:var(--color-blue-200)]"
                        : isCurrent
                          ? "bg-[color:var(--color-blue-500)]/15 text-[color:var(--color-blue-100)]"
                          : "text-slate-300 hover:bg-slate-800/70"
                    }`}
                  >
                    {node.label}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-start gap-3">
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={handleOpenCreateFolderForm}
              disabled={creatingFolder}
              className={`relative h-9 w-9 shrink-0 rounded border workspace-themed-link disabled:opacity-50 ${
                showCreateFolderForm
                  ? "bg-[color:var(--color-blue-500)]/15 border-[color:var(--color-blue-500)]/35"
                  : "bg-slate-900 hover:bg-slate-900/60"
              }`}
              aria-label="Create folder"
              title="Create folder"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                className="mx-auto h-5 w-5"
                aria-hidden="true"
              >
                <path
                  d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full workspace-primary-action text-white">
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="h-2.5 w-2.5"
                  aria-hidden="true"
                >
                  <path d="M8 3.5v9M3.5 8h9" strokeLinecap="round" />
                </svg>
              </span>
            </button>

            {showCreateFolderForm && (
              <form
                onSubmit={handleCreateFolderSubmit}
                className="flex flex-wrap items-center gap-2"
              >
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  maxLength={120}
                  autoFocus
                  className="w-48 border rounded px-3 py-2 text-sm"
                />
                <button
                  type="submit"
                  disabled={creatingFolder}
                  className="px-3 py-2 border rounded text-sm hover:bg-slate-900/60 disabled:opacity-50"
                >
                  {creatingFolder ? "Creating..." : "Create"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelCreateFolderForm}
                  disabled={creatingFolder}
                  className="px-3 py-2 border rounded text-sm hover:bg-slate-900/60 disabled:opacity-50"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>

          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="updatedAt">Sort: Last changed</option>
            <option value="fileSize">Sort: Size</option>
            <option value="title">Sort: Name</option>
            <option value="fileType">Sort: File type</option>
          </select>

          <button
            type="button"
            onClick={() =>
              setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
            }
            className="px-3 py-2 border rounded text-sm hover:bg-slate-900/60"
          >
            {sortDirection === "asc" ? "Ascending" : "Descending"}
          </button>
        </div>

        {folderError && <p className="text-red-400 text-sm">{folderError}</p>}
        {moveError && <p className="text-red-400 text-sm">{moveError}</p>}
        <p className="text-xs text-slate-400">
          Selected files: {selectedMaterialIds.length}.
        </p>
        <p className="text-xs text-slate-400">
          Drag files or folders onto a folder row or path segment. Files support Ctrl/Cmd and Shift multi-select.
        </p>

        {loading && <p className="text-slate-400">Loading...</p>}
        {error && <p className="text-red-400">{error}</p>}

        {!loading && !error && (
          <div className="overflow-x-auto border rounded">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b text-left text-slate-400">
                  <th className="py-2 px-3">Name</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3">Size</th>
                  <th className="py-2 px-3">Last changed</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3" />
                </tr>
              </thead>
              <tbody>
                {childFolders.map((folder) => (
                  <tr
                    key={folder.id}
                    draggable={
                      editingFolderId !== folder.id &&
                      deletingFolderId !== folder.id &&
                      renamingFolderId !== folder.id &&
                      movingFolderId !== folder.id
                    }
                    onDragStart={(e) => handleFolderRowDragStart(e, folder.id)}
                    onDragEnd={handleFolderRowDragEnd}
                    onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                    onDrop={(e) => void handleFolderDrop(e, folder.id)}
                    className={`border-b ${
                      dropTargetKey === folderDropKey(folder.id)
                        ? "bg-[color:var(--color-blue-500)]/10"
                        : "hover:bg-slate-900/60"
                    } ${draggedFolderId === folder.id ? "opacity-50" : ""} ${
                      movingFolderId === folder.id ? "opacity-50" : "cursor-grab"
                    }`}
                  >
                    <td className="py-3 px-3 font-medium">
                      {editingFolderId === folder.id ? (
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void submitFolderRename(folder);
                          }}
                          className="flex items-center gap-2"
                        >
                          <input
                            type="text"
                            value={editingFolderName}
                            onChange={(e) => setEditingFolderName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.preventDefault();
                                cancelFolderRename();
                              }
                            }}
                            autoFocus
                            maxLength={120}
                            disabled={renamingFolderId === folder.id}
                            className="w-52 border rounded px-2 py-1 text-sm disabled:opacity-50"
                          />
                          <button
                            type="submit"
                            disabled={renamingFolderId === folder.id}
                            className="workspace-themed-link hover:underline text-xs disabled:opacity-50"
                          >
                            {renamingFolderId === folder.id ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelFolderRename}
                            disabled={renamingFolderId === folder.id}
                            className="text-slate-400 hover:underline text-xs disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openFolder(folder.id)}
                          className="workspace-themed-link hover:underline"
                        >
                          {folder.name}
                        </button>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-400">Folder</td>
                    <td className="py-3 px-3 text-slate-500">-</td>
                    <td className="py-3 px-3 text-slate-400">
                      {new Date(folder.updatedAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-slate-500">-</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {editingFolderId !== folder.id && (
                          <button
                            type="button"
                            onClick={() => startFolderRename(folder)}
                            disabled={
                              deletingFolderId === folder.id ||
                              renamingFolderId === folder.id ||
                              movingFolderId !== null
                            }
                            className="workspace-themed-link hover:underline text-xs disabled:opacity-50"
                          >
                            Rename
                          </button>
                        )}
                        {deleteFolderConfirmId === folder.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleDeleteFolder(folder)}
                              disabled={deletingFolderId === folder.id}
                              className="text-red-300 hover:underline text-xs disabled:opacity-50"
                            >
                              {deletingFolderId === folder.id ? "Deleting..." : "Confirm delete"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteFolderConfirmId(null)}
                              disabled={deletingFolderId === folder.id}
                              className="text-slate-300 hover:underline text-xs disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteFolderConfirmId(folder.id)}
                            disabled={
                              deletingFolderId === folder.id ||
                              renamingFolderId === folder.id ||
                              movingFolderId !== null
                            }
                            className="text-red-400 hover:underline text-xs disabled:opacity-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {sortedMaterials.map((material) => (
                  <tr
                    key={material.id}
                    draggable={!movingMaterialSet.has(material.id) && movingFolderId === null}
                    onClick={(e) => handleMaterialRowClick(e, material.id)}
                    onDragStart={(e) => handleMaterialDragStart(e, material.id)}
                    onDragEnd={handleMaterialDragEnd}
                    className={`border-b hover:bg-slate-900/60 ${
                      draggedMaterialSet.has(material.id) ? "opacity-40" : ""
                    } ${movingMaterialSet.has(material.id) ? "opacity-50" : "cursor-grab"} ${
                      selectedMaterialSet.has(material.id) ? "bg-[color:var(--color-blue-500)]/15" : ""
                    }`}
                  >
                    <td className="py-3 px-3 font-medium">
                      <Link
                        href={`/teacher/materials/${material.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline workspace-themed-link"
                      >
                        {material.title}
                      </Link>
                      <p className="text-xs text-slate-400">{material.originalFilename}</p>
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {fileTypeLabel(material.originalFilename, material.mimeType)}
                    </td>
                    <td className="py-3 px-3 text-slate-400">{formatBytes(material.fileSize)}</td>
                    <td className="py-3 px-3 text-slate-400">
                      {new Date(material.updatedAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={material.status} />
                    </td>
                    <td className="py-3 px-3 text-right">
                      {deleteMaterialConfirmId === material.id ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleDelete(material.id, material.title);
                            }}
                            className="text-red-300 hover:underline text-xs"
                          >
                            Confirm delete
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteMaterialConfirmId(null);
                            }}
                            className="text-slate-300 hover:underline text-xs"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteMaterialConfirmId(material.id);
                          }}
                          disabled={movingMaterialSet.has(material.id) || movingFolderId !== null}
                          className="text-red-400 hover:underline text-xs disabled:opacity-50"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {childFolders.length === 0 && sortedMaterials.length === 0 && (
                  <tr>
                    <td className="py-6 px-3 text-slate-400" colSpan={6}>
                      This folder is empty.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
