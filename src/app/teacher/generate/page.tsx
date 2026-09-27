"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

interface MaterialTag {
  key: string;
  value: string;
}

interface MaterialSummary {
  id: string;
  title: string;
  originalFilename: string;
  mimeType?: string;
  status: string;
  updatedAt?: string;
  folderId?: string | null;
  folderPath?: string | null;
  tags?: MaterialTag[];
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

interface ExternalSourceProfileSummary {
  id: string;
  name: string;
  includeWhitelist: boolean;
  urls: string[];
}

const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
const FORMATS = ["SINGLE_ASSIGNMENT", "WORKSHEET"] as const;
const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 20;
const SLIDER_THUMB_SIZE_REM = 1;
const MAX_LONG_INPUT_LENGTH = 10000;

export default function GeneratePage() {
  const router = useRouter();

  const [materials, setMaterials] = useState<MaterialSummary[]>([]);
  const [folders, setFolders] = useState<MaterialFolderSummary[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [loadingMaterials, setLoadingMaterials] = useState(true);
  const [materialsError, setMaterialsError] = useState<string | null>(null);

  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [selectedFromSearch, setSelectedFromSearch] = useState<string[]>([]);
  const [materialSearch, setMaterialSearch] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [topic, setTopic] = useState("");
  const [section, setSection] = useState("");
  const [difficulty, setDifficulty] =
    useState<(typeof DIFFICULTIES)[number]>("MEDIUM");
  const [format, setFormat] =
    useState<(typeof FORMATS)[number]>("SINGLE_ASSIGNMENT");
  const [questionCount, setQuestionCount] = useState(5);
  const [educationalGoals, setEducationalGoals] = useState("");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [knowledgeMode, setKnowledgeMode] =
    useState<"INTERNAL_ONLY" | "HYBRID_EXTERNAL">("INTERNAL_ONLY");
  const [sourceProfiles, setSourceProfiles] = useState<ExternalSourceProfileSummary[]>(
    []
  );
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  const [selectedSourceProfileId, setSelectedSourceProfileId] = useState("");
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileUrls, setNewProfileUrls] = useState("");
  const [newProfileIncludeWhitelist, setNewProfileIncludeWhitelist] = useState(true);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const questionCountRatio =
    (questionCount - MIN_QUESTION_COUNT) /
    (MAX_QUESTION_COUNT - MIN_QUESTION_COUNT);
  const questionCountLeft = `calc(${questionCountRatio} * (100% - ${SLIDER_THUMB_SIZE_REM}rem) + ${SLIDER_THUMB_SIZE_REM / 2}rem)`;
  const isQuestionCountAtEdge =
    questionCount === MIN_QUESTION_COUNT || questionCount === MAX_QUESTION_COUNT;

  const selectedMaterialSet = useMemo(
    () => new Set(selectedMaterials),
    [selectedMaterials]
  );
  const selectedFromSearchSet = useMemo(
    () => new Set(selectedFromSearch),
    [selectedFromSearch]
  );

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

  const childFolders = useMemo(
    () =>
      folders
        .filter((folder) => folder.parentId === currentFolderId)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [folders, currentFolderId]
  );

  const normalizedMaterialSearch = materialSearch.trim().toLowerCase();

  const filteredChildFolders = useMemo(() => {
    if (showSelectedOnly) return [];
    if (!normalizedMaterialSearch) return childFolders;

    return childFolders.filter((folder) =>
      `${folder.name} ${folder.path}`.toLowerCase().includes(normalizedMaterialSearch)
    );
  }, [childFolders, normalizedMaterialSearch, showSelectedOnly]);

  const materialsInCurrentFolder = useMemo(
    () =>
      materials.filter((material) => (material.folderId ?? null) === currentFolderId),
    [materials, currentFolderId]
  );

  const filteredMaterials = useMemo(() => {
    return materialsInCurrentFolder.filter((material) => {
      if (showSelectedOnly && !selectedMaterialSet.has(material.id)) {
        return false;
      }

      if (!normalizedMaterialSearch) {
        return true;
      }

      const tagsText = (material.tags ?? [])
        .map((tag) => `${tag.key} ${tag.value}`)
        .join(" ");
      const searchableText =
        `${material.title} ${material.originalFilename} ${tagsText} ${material.folderPath ?? "Root"}`.toLowerCase();

      return searchableText.includes(normalizedMaterialSearch);
    });
  }, [
    materialsInCurrentFolder,
    normalizedMaterialSearch,
    selectedMaterialSet,
    showSelectedOnly,
  ]);

  const filteredMaterialIds = useMemo(
    () => filteredMaterials.map((material) => material.id),
    [filteredMaterials]
  );

  const filteredMaterialIdSet = useMemo(
    () => new Set(filteredMaterialIds),
    [filteredMaterialIds]
  );

  const selectedInFilteredCount = useMemo(
    () =>
      filteredMaterials.reduce(
        (count, material) =>
          count + (selectedMaterialSet.has(material.id) ? 1 : 0),
        0
      ),
    [filteredMaterials, selectedMaterialSet]
  );

  const selectedFromSearchInFilteredCount = useMemo(
    () =>
      filteredMaterials.reduce(
        (count, material) =>
          count +
          Number(
            selectedMaterialSet.has(material.id) &&
              selectedFromSearchSet.has(material.id)
          ),
        0
      ),
    [filteredMaterials, selectedMaterialSet, selectedFromSearchSet]
  );

  const showClearSelectedInResultsButton =
    normalizedMaterialSearch.length > 0 ||
    selectedFromSearchInFilteredCount > 0;

  const allFilteredSelected =
    filteredMaterials.length > 0 &&
    filteredMaterials.every((material) => selectedMaterialSet.has(material.id));

  const displayedMaterials = useMemo(() => {
    const orderById = new Map(
      materials.map((material, index) => [material.id, index])
    );

    return [...filteredMaterials].sort((a, b) => {
      const selectedDelta =
        Number(selectedMaterialSet.has(b.id)) - Number(selectedMaterialSet.has(a.id));
      if (selectedDelta !== 0) return selectedDelta;
      return (orderById.get(a.id) ?? 0) - (orderById.get(b.id) ?? 0);
    });
  }, [filteredMaterials, materials, selectedMaterialSet]);

  useEffect(() => {
    let active = true;

    async function loadSourceData() {
      setLoadingMaterials(true);
      setMaterialsError(null);
      setLoadingProfiles(true);
      setProfilesError(null);

      try {
        const [materialsRes, foldersRes, profilesRes] = await Promise.all([
          fetch("/api/materials"),
          fetch("/api/materials/folders"),
          fetch("/api/generation/source-profiles"),
        ]);

        const [materialsJson, foldersJson, profilesJson] = await Promise.all([
          materialsRes.json(),
          foldersRes.json(),
          profilesRes.json(),
        ]);

        if (!materialsJson.success) {
          throw new Error(materialsJson.error || "Failed to load materials");
        }
        if (!foldersJson.success) {
          throw new Error(foldersJson.error || "Failed to load folders");
        }
        if (!profilesJson.success) {
          throw new Error(profilesJson.error || "Failed to load source profiles");
        }

        if (!active) return;
        setMaterials(
          (materialsJson.data as MaterialSummary[]).filter((m) => m.status === "READY")
        );
        setFolders(foldersJson.data as MaterialFolderSummary[]);
        setSourceProfiles(profilesJson.data as ExternalSourceProfileSummary[]);
      } catch (e) {
        if (!active) return;
        const message =
          e instanceof Error ? e.message : "Failed to load source data";
        setMaterialsError(message);
        setProfilesError(message);
      } finally {
        if (active) {
          setLoadingMaterials(false);
          setLoadingProfiles(false);
        }
      }
    }

    void loadSourceData();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (knowledgeMode !== "HYBRID_EXTERNAL") return;
    if (selectedSourceProfileId && sourceProfiles.some((profile) => profile.id === selectedSourceProfileId)) {
      return;
    }
    setSelectedSourceProfileId(sourceProfiles[0]?.id ?? "");
  }, [knowledgeMode, selectedSourceProfileId, sourceProfiles]);

  useEffect(() => {
    if (!currentFolderId) return;
    if (!folderMap.has(currentFolderId)) {
      setCurrentFolderId(null);
    }
  }, [currentFolderId, folderMap]);

  useEffect(() => {
    setSelectedFromSearch((prev) => {
      const next = prev.filter((id) => selectedMaterialSet.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [selectedMaterialSet]);

  function toggleMaterial(id: string) {
    const isSelected = selectedMaterialSet.has(id);
    if (isSelected) {
      setSelectedMaterials((prev) => prev.filter((x) => x !== id));
      setSelectedFromSearch((prev) => prev.filter((x) => x !== id));
      return;
    }

    setSelectedMaterials((prev) => [...prev, id]);
    if (normalizedMaterialSearch.length > 0) {
      setSelectedFromSearch((prev) => (prev.includes(id) ? prev : [...prev, id]));
    }
  }

  function selectAllFilteredMaterials() {
    setSelectedMaterials((prev) => {
      const next = new Set(prev);
      filteredMaterialIds.forEach((id) => next.add(id));
      return [...next];
    });

    if (normalizedMaterialSearch.length > 0) {
      setSelectedFromSearch((prev) => {
        const next = new Set(prev);
        filteredMaterialIds.forEach((id) => next.add(id));
        return [...next];
      });
    }
  }

  function clearFilteredSelection() {
    setSelectedMaterials((prev) =>
      prev.filter((id) => !filteredMaterialIdSet.has(id))
    );
    setSelectedFromSearch((prev) =>
      prev.filter((id) => !filteredMaterialIdSet.has(id))
    );
  }

  function clearAllSelectedMaterials() {
    setSelectedMaterials([]);
    setSelectedFromSearch([]);
  }

  function openFolder(folderId: string | null) {
    setCurrentFolderId(folderId);
  }

  async function refreshSourceProfiles() {
    const res = await fetch("/api/generation/source-profiles");
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error ?? "Failed to load source profiles");
    }
    setSourceProfiles(json.data as ExternalSourceProfileSummary[]);
  }

  async function handleCreateSourceProfile() {
    setProfilesError(null);

    const urls = newProfileUrls
      .split(/\r?\n|,/)
      .map((url) => url.trim())
      .filter(Boolean);

    if (!newProfileName.trim()) {
      setProfilesError("Profile name is required");
      return;
    }

    setCreatingProfile(true);
    try {
      const res = await fetch("/api/generation/source-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProfileName.trim(),
          includeWhitelist: newProfileIncludeWhitelist,
          urls,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to create profile");

      await refreshSourceProfiles();
      setSelectedSourceProfileId(json.data.id as string);
      setNewProfileName("");
      setNewProfileUrls("");
      setNewProfileIncludeWhitelist(true);
    } catch (err) {
      setProfilesError(err instanceof Error ? err.message : "Failed to create profile");
    } finally {
      setCreatingProfile(false);
    }
  }

  async function handleDeleteSourceProfile(id: string) {
    setProfilesError(null);
    setDeletingProfileId(id);
    try {
      const res = await fetch(`/api/generation/source-profiles/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Failed to delete profile");

      await refreshSourceProfiles();
      if (selectedSourceProfileId === id) {
        setSelectedSourceProfileId("");
      }
    } catch (err) {
      setProfilesError(err instanceof Error ? err.message : "Failed to delete profile");
    } finally {
      setDeletingProfileId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!topic.trim()) {
      setSubmitError("Topic is required");
      return;
    }
    if (knowledgeMode === "HYBRID_EXTERNAL" && !selectedSourceProfileId) {
      setSubmitError("Select a source profile for hybrid external mode");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          constraints: {
            topic: topic.trim(),
            section: section.trim() || undefined,
            difficulty,
            format,
            questionCount,
            educationalGoals: educationalGoals.trim() || undefined,
            additionalInstructions:
              additionalInstructions.trim() || undefined,
            knowledgeMode,
            externalSourceProfileId:
              knowledgeMode === "HYBRID_EXTERNAL"
                ? selectedSourceProfileId
                : undefined,
          },
          materialIds: selectedMaterials,
        }),
      });

      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      router.push(`/teacher/generate/${json.data.id}`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Generation failed");
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-100">Generate Assignment</h1>
        <p className="mt-2 text-sm text-slate-400">
          Configure constraints and select source materials. The system will plan and generate an
          assignment draft for your review.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="mb-3 font-semibold text-slate-100">
            Source Materials{" "}
            <span className="text-slate-500 font-normal text-sm">
              (optional - select materials to ground the generation)
            </span>
          </h2>

          {loadingMaterials && (
            <p className="text-slate-500 text-sm">Loading materials...</p>
          )}

          {materialsError && <p className="text-red-500 text-sm">{materialsError}</p>}

          {!loadingMaterials &&
            materials.length === 0 &&
            folders.length === 0 &&
            !materialsError && (
            <p className="text-slate-500 text-sm">
              No ready materials or folders found.{" "}
              <Link href="/teacher/materials" className="workspace-themed-link underline">
                Upload materials
              </Link>{" "}
              first.
            </p>
            )}

          {!loadingMaterials &&
            (materials.length > 0 || folders.length > 0) &&
            !materialsError && (
            <div className="mt-3 space-y-3">
              <div className="overflow-x-auto">
                <div className="inline-flex min-w-full items-center gap-1 rounded-xl border bg-slate-900 px-2 py-1.5 text-sm text-slate-300">
                  <button
                    type="button"
                    onClick={() => openFolder(null)}
                    className={`rounded-md px-3 py-1.5 whitespace-nowrap transition-colors ${
                      currentFolderId === null
                        ? "workspace-active-item"
                        : "text-slate-300 hover:bg-slate-800/70"
                    }`}
                  >
                    Materials
                  </button>

                  {breadcrumbs.map((crumb) => (
                    <div key={crumb.id} className="flex items-center gap-1">
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
                      <button
                        type="button"
                        onClick={() => openFolder(crumb.id)}
                        className={`rounded-md px-3 py-1.5 whitespace-nowrap transition-colors ${
                          crumb.id === currentFolderId
                            ? "workspace-active-item"
                            : "text-slate-300 hover:bg-slate-800/70"
                        }`}
                      >
                        {crumb.name}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <input
                  type="text"
                  value={materialSearch}
                  onChange={(e) => setMaterialSearch(e.target.value)}
                  placeholder="Search by title, filename, folder, or tags"
                  className="w-full sm:flex-1 border rounded px-3 py-2 text-sm"
                />
                <label className="inline-flex items-center gap-2 text-sm text-slate-400">
                  <input
                    type="checkbox"
                    checked={showSelectedOnly}
                    onChange={(e) => setShowSelectedOnly(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Show selected only
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={selectAllFilteredMaterials}
                  disabled={filteredMaterials.length === 0 || allFilteredSelected}
                  className="px-2.5 py-1 border rounded hover:bg-slate-900/60 disabled:opacity-50"
                >
                  Select all files ({filteredMaterials.length})
                </button>
                {showClearSelectedInResultsButton && (
                  <button
                    type="button"
                    onClick={clearFilteredSelection}
                    disabled={selectedInFilteredCount === 0}
                    className="px-2.5 py-1 border rounded hover:bg-slate-900/60 disabled:opacity-50"
                  >
                    Clear selected in results ({selectedInFilteredCount})
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearAllSelectedMaterials}
                  disabled={selectedMaterials.length === 0}
                  className="px-2.5 py-1 border rounded hover:bg-slate-900/60 disabled:opacity-50"
                >
                  Clear all selected ({selectedMaterials.length})
                </button>
              </div>

              <p className="text-xs text-slate-400">
                Folder: {currentFolderPath}. Folders: {filteredChildFolders.length}. Files:{" "}
                {displayedMaterials.length} of {materialsInCurrentFolder.length}. Selected files:{" "}
                {selectedMaterials.length}.
              </p>

              {displayedMaterials.length === 0 && filteredChildFolders.length === 0 ? (
                <p className="rounded border border-slate-800 bg-slate-950/35 p-3 text-sm text-slate-500">
                  No folders or materials match your current filter.
                </p>
              ) : (
                <div className="max-h-72 overflow-y-auto rounded-md border border-slate-800 bg-slate-950/25 divide-y divide-slate-800">
                  {filteredChildFolders.map((folder) => (
                    <button
                      key={folder.id}
                      type="button"
                      onClick={() => openFolder(folder.id)}
                      className="w-full flex items-start gap-3 p-3 text-left hover:bg-slate-900/60"
                    >
                      <span className="mt-0.5 workspace-themed-link" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
                          <path
                            d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"
                            strokeWidth="1.7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span className="text-sm min-w-0">
                        <span className="font-medium text-slate-100">{folder.name}</span>
                      </span>
                    </button>
                  ))}

                  {displayedMaterials.map((m) => (
                    <label
                      key={m.id}
                      className="flex items-start gap-3 cursor-pointer p-3 hover:bg-slate-900/60"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMaterialSet.has(m.id)}
                        onChange={() => toggleMaterial(m.id)}
                        className="w-4 h-4 mt-0.5"
                      />
                      <span className="text-sm min-w-0">
                        <span className="font-medium text-slate-100">{m.title}</span>{" "}
                        <span className="text-slate-500 break-all">
                          ({m.originalFilename})
                        </span>
                        {m.tags && m.tags.length > 0 && (
                          <span className="block text-xs text-slate-400 mt-1">
                            {m.tags
                              .map((tag) => `${tag.key}: ${tag.value}`)
                              .join(" | ")}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="font-semibold text-slate-100">Constraints</h2>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              Topic <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              maxLength={200}
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="e.g. Quadratic equations"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Section</label>
            <input
              type="text"
              maxLength={200}
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="e.g. Chapter 3 - Factoring"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value as typeof difficulty)
                }
                className="w-full border rounded px-3 py-2 text-sm"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d.charAt(0) + d.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Format</label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as typeof format)}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f === "SINGLE_ASSIGNMENT" ? "Single Assignment" : "Worksheet"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              Number of Questions{" "}
            </label>
            <div className="relative pb-7">
              <input
                type="range"
                min={MIN_QUESTION_COUNT}
                max={MAX_QUESTION_COUNT}
                step={1}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-700 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-slate-700 [&::-webkit-slider-thumb]:mt-[-4px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[color:var(--color-blue-600)] [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-slate-700 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[color:var(--color-blue-600)]"
                aria-label="Number of Questions"
              />
              {!isQuestionCountAtEdge && (
                <span
                  className="absolute top-6 -translate-x-1/2 text-sm font-medium text-slate-300"
                  style={{ left: questionCountLeft }}
                >
                  {questionCount}
                </span>
              )}
              <span
                className="absolute top-6 -translate-x-1/2 text-sm font-medium text-slate-300"
                style={{ left: `${SLIDER_THUMB_SIZE_REM / 2}rem` }}
              >
                {MIN_QUESTION_COUNT}
              </span>
              <span
                className="absolute top-6 -translate-x-1/2 text-sm font-medium text-slate-300"
                style={{ left: `calc(100% - ${SLIDER_THUMB_SIZE_REM / 2}rem)` }}
              >
                {MAX_QUESTION_COUNT}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              Educational Goals
            </label>
            <textarea
              maxLength={MAX_LONG_INPUT_LENGTH}
              rows={4}
              value={educationalGoals}
              onChange={(e) => setEducationalGoals(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm resize-y min-h-24"
              placeholder="e.g. Students should be able to factor trinomials and apply the quadratic formula"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              Additional Instructions
            </label>
            <textarea
              maxLength={MAX_LONG_INPUT_LENGTH}
              rows={7}
              value={additionalInstructions}
              onChange={(e) => setAdditionalInstructions(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm resize-y min-h-40"
              placeholder="e.g. Include at least one word problem"
            />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/40 p-5">
          <h2 className="font-semibold text-slate-100">Knowledge Sources</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-slate-300">
              <input
                type="radio"
                name="knowledgeMode"
                checked={knowledgeMode === "INTERNAL_ONLY"}
                onChange={() => setKnowledgeMode("INTERNAL_ONLY")}
                className="w-4 h-4"
              />
              Internal materials only
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-slate-300">
              <input
                type="radio"
                name="knowledgeMode"
                checked={knowledgeMode === "HYBRID_EXTERNAL"}
                onChange={() => setKnowledgeMode("HYBRID_EXTERNAL")}
                className="w-4 h-4"
              />
              Hybrid external knowledge
            </label>
          </div>

          {knowledgeMode === "HYBRID_EXTERNAL" && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-300">
                  Source Profile
                </label>
                <select
                  value={selectedSourceProfileId}
                  onChange={(e) => setSelectedSourceProfileId(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                  disabled={loadingProfiles}
                >
                  <option value="">Select profile</option>
                  {sourceProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name} ({profile.urls.length} URL{profile.urls.length === 1 ? "" : "s"})
                    </option>
                  ))}
                </select>
                {loadingProfiles && (
                  <p className="text-xs text-slate-500 mt-1">Loading source profiles...</p>
                )}
              </div>

              <div className="space-y-2 rounded border border-slate-800 bg-slate-950/35 p-3">
                <p className="text-sm font-medium text-slate-100">Create Source Profile</p>
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  maxLength={120}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="Profile name"
                />
                <textarea
                  value={newProfileUrls}
                  onChange={(e) => setNewProfileUrls(e.target.value)}
                  rows={4}
                  className="w-full border rounded px-3 py-2 text-sm resize-y"
                  placeholder="One HTTPS URL per line"
                />
                <label className="inline-flex items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={newProfileIncludeWhitelist}
                    onChange={(e) => setNewProfileIncludeWhitelist(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Include curated whitelist sources
                </label>
                <button
                  type="button"
                  onClick={() => void handleCreateSourceProfile()}
                  disabled={creatingProfile}
                  className="px-3 py-1.5 bg-slate-800 rounded text-sm hover:bg-slate-700 disabled:opacity-50"
                >
                  {creatingProfile ? "Creating..." : "Create Profile"}
                </button>
              </div>

              {sourceProfiles.length > 0 && (
                <ul className="space-y-2">
                  {sourceProfiles.map((profile) => (
                    <li key={profile.id} className="rounded border border-slate-800 bg-slate-950/35 p-3 text-xs text-slate-400">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-slate-200">{profile.name}</p>
                        <button
                          type="button"
                          onClick={() => void handleDeleteSourceProfile(profile.id)}
                          disabled={deletingProfileId === profile.id}
                          className="px-2 py-1 border rounded text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          {deletingProfileId === profile.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                      <p className="mt-1">
                        URLs: {profile.urls.length}. Whitelist: {profile.includeWhitelist ? "ON" : "OFF"}.
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {profilesError && <p className="text-red-500 text-sm">{profilesError}</p>}
            </div>
          )}

          {knowledgeMode === "INTERNAL_ONLY" && (
            <p className="text-xs text-slate-500">
              Additional Instructions links are still extracted by AI and used as request-scoped sources.
            </p>
          )}
        </section>

        {submitError && <p className="text-sm text-red-400">{submitError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 workspace-primary-action text-white rounded font-medium disabled:opacity-50"
        >
          {submitting
            ? "Generating... this may take a moment"
            : "Generate Assignment"}
        </button>
      </form>
    </main>
  );
}
