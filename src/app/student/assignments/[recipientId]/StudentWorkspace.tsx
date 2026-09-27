"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useWorkspaceStore } from "@/modules/completion/workspace-store";
import { AI_HELP_MODE_DESCRIPTIONS, AI_HELP_MODE_LABELS } from "@/modules/ai-help/mode-definitions";
import type { AttemptDetail, StudentItemContent } from "@/modules/completion/types";
import {
  buildQuestionNavItems,
  canSubmitWithSoftWarning,
  getAnsweredCount,
  getInitialQuestionOrder,
  getNextQuestionOrder,
  getPreviousQuestionOrder,
  getUnansweredQuestionOrders,
  isAnswerFilled,
  normalizeQuestionOrders,
  type WorkspaceViewMode,
} from "@/modules/completion/navigation";

interface Props {
  initialAttempt: AttemptDetail;
}

type HelpChatMessage = {
  role: "student" | "assistant";
  content: string;
};

type RestrictedEventType =
  | "COPY_BLOCKED"
  | "SCREENSHOT_ATTEMPT"
  | "TAB_SWITCH"
  | "WINDOW_BLUR";

const AUTOSAVE_DELAY_MS = 800;
const RESTRICTED_NOTICE_TIMEOUT_MS = 2400;
const RESTRICTED_EVENT_COOLDOWN_MS: Record<RestrictedEventType, number> = {
  COPY_BLOCKED: 1000,
  SCREENSHOT_ATTEMPT: 1200,
  TAB_SWITCH: 1600,
  WINDOW_BLUR: 1600,
};

function isProtectedElementTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest('[data-protected-question="true"]') !== null;
}

function isProtectedNode(node: Node | null): boolean {
  if (!node) return false;
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return element?.closest('[data-protected-question="true"]') !== null;
}

function selectionTouchesProtectedContent(): boolean {
  const selection = window.getSelection();
  if (!selection) return false;
  return isProtectedNode(selection.anchorNode) || isProtectedNode(selection.focusNode);
}

function getQuestionTypeLabel(type: StudentItemContent["type"]): string {
  return type.replaceAll("_", " ");
}

function formatSaveState(
  saveState: "idle" | "dirty" | "saving" | "saved" | "error",
  isSaving: boolean,
  isDirty: boolean,
  hasPendingAutosave: boolean,
  lastSavedAt: number | null
): string {
  if (isSaving || saveState === "saving") return "Saving...";
  if (saveState === "error") return "Save failed";
  if (isDirty || hasPendingAutosave || saveState === "dirty") return "Unsaved changes";
  if (saveState === "saved" && lastSavedAt !== null) {
    return `Saved at ${new Date(lastSavedAt).toLocaleTimeString()}`;
  }
  return "Saved";
}

export default function StudentWorkspace({ initialAttempt }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const {
    attemptId,
    status,
    answers,
    isDirty,
    isSaving,
    isSubmitting,
    saveError,
    submitError,
    saveState,
    lastSavedAt,
    hasPendingAutosave,
    load,
    reset,
    setAnswer,
    markSaving,
    markSaved,
    markSaveError,
    markSubmitting,
    markSubmitted,
    markSubmitError,
    getAnswersArray,
  } = useWorkspaceStore();

  const [viewMode, setViewMode] = useState<WorkspaceViewMode>("QUESTION");
  const [currentQuestionOrder, setCurrentQuestionOrder] = useState<number | null>(null);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [isHelpSidebarOpen, setIsHelpSidebarOpen] = useState(false);
  const [activeHelpItem, setActiveHelpItem] = useState<number | null>(null);
  const [helpQuestion, setHelpQuestion] = useState("");
  const [helpLoading, setHelpLoading] = useState(false);
  const [helpError, setHelpError] = useState<string | null>(null);
  const [helpChats, setHelpChats] = useState<Record<number, HelpChatMessage[]>>({});
  const [navigatorHeight, setNavigatorHeight] = useState<number | null>(null);
  const [restrictedNotice, setRestrictedNotice] = useState<string | null>(null);
  const questionPaneRef = useRef<HTMLDivElement | null>(null);
  const chatBodyRef = useRef<HTMLDivElement | null>(null);
  const savePromiseRef = useRef<Promise<boolean> | null>(null);
  const restrictedNoticeTimerRef = useRef<number | null>(null);
  const restrictedEventCooldownRef = useRef<Record<RestrictedEventType, number>>({
    COPY_BLOCKED: 0,
    SCREENSHOT_ATTEMPT: 0,
    TAB_SWITCH: 0,
    WINDOW_BLUR: 0,
  });

  useEffect(() => {
    load(initialAttempt.id, initialAttempt.status, initialAttempt.answers);
    return () => reset();
  }, [initialAttempt.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isSubmitted = status === "SUBMITTED";
  const { title, instructions, items } = initialAttempt.assignmentContent;
  const aiHelpMode = initialAttempt.aiHelpMode;
  const isRestrictedMode =
    !isSubmitted &&
    initialAttempt.distributionStatus === "MANDATORY" &&
    initialAttempt.isGraded &&
    aiHelpMode === "NO_HELP";
  const helpEnabled = aiHelpMode === "CLARIFICATION" || aiHelpMode === "GUIDED";

  const questionOrders = useMemo(
    () => normalizeQuestionOrders(items.map((item) => item.order)),
    [items]
  );
  const totalQuestions = questionOrders.length;
  const attemptStorageKey = useMemo(
    () => `student-attempt:last-question:${initialAttempt.id}`,
    [initialAttempt.id]
  );

  const orderedItems = useMemo(() => {
    const byOrder = new Map(items.map((item) => [item.order, item]));
    return questionOrders
      .map((order) => byOrder.get(order))
      .filter((item): item is StudentItemContent => item !== undefined);
  }, [items, questionOrders]);

  useEffect(() => {
    if (questionOrders.length === 0 || currentQuestionOrder !== null) return;
    const storedQuestion =
      typeof window !== "undefined" ? window.localStorage.getItem(attemptStorageKey) : null;
    const initialQuestionOrder = getInitialQuestionOrder(
      questionOrders,
      searchParams.get("q"),
      storedQuestion
    );
    setCurrentQuestionOrder(initialQuestionOrder);
  }, [attemptStorageKey, currentQuestionOrder, questionOrders, searchParams]);

  useEffect(() => {
    if (questionOrders.length === 0 || currentQuestionOrder === null) return;
    if (questionOrders.includes(currentQuestionOrder)) return;
    setCurrentQuestionOrder(questionOrders[0]);
  }, [currentQuestionOrder, questionOrders]);

  useEffect(() => {
    if (currentQuestionOrder === null) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(attemptStorageKey, String(currentQuestionOrder));
    }
    const currentQueryQuestion = searchParams.get("q");
    if (currentQueryQuestion === String(currentQuestionOrder)) return;
    router.replace(`${pathname}?q=${currentQuestionOrder}`, { scroll: false });
  }, [attemptStorageKey, currentQuestionOrder, pathname, router, searchParams]);

  const activeHelpQuestion = useMemo(
    () => orderedItems.find((item) => item.order === activeHelpItem) ?? null,
    [orderedItems, activeHelpItem]
  );
  const activeChat = useMemo(
    () => (activeHelpItem !== null ? helpChats[activeHelpItem] ?? [] : []),
    [activeHelpItem, helpChats]
  );

  const currentQuestion = useMemo(() => {
    if (orderedItems.length === 0) return null;
    if (currentQuestionOrder === null) return orderedItems[0];
    return orderedItems.find((item) => item.order === currentQuestionOrder) ?? orderedItems[0];
  }, [currentQuestionOrder, orderedItems]);

  const answeredCount = useMemo(() => getAnsweredCount(questionOrders, answers), [questionOrders, answers]);
  const unansweredQuestionOrders = useMemo(
    () => getUnansweredQuestionOrders(questionOrders, answers),
    [questionOrders, answers]
  );
  const unansweredCount = unansweredQuestionOrders.length;
  const completionPercent = totalQuestions === 0 ? 0 : Math.round((answeredCount / totalQuestions) * 100);
  const navItems = useMemo(
    () => buildQuestionNavItems(questionOrders, answers, currentQuestionOrder, viewMode),
    [answers, currentQuestionOrder, questionOrders, viewMode]
  );

  const saveStatusLabel = useMemo(
    () => formatSaveState(saveState, isSaving, isDirty, hasPendingAutosave, lastSavedAt),
    [saveState, isSaving, isDirty, hasPendingAutosave, lastSavedAt]
  );

  const showRestrictedNotice = useCallback((message: string) => {
    setRestrictedNotice(message);
    if (restrictedNoticeTimerRef.current !== null) {
      window.clearTimeout(restrictedNoticeTimerRef.current);
    }
    restrictedNoticeTimerRef.current = window.setTimeout(() => {
      setRestrictedNotice(null);
      restrictedNoticeTimerRef.current = null;
    }, RESTRICTED_NOTICE_TIMEOUT_MS);
  }, []);

  const reportRestrictedEvent = useCallback(
    async (eventType: RestrictedEventType, meta?: Record<string, unknown>) => {
      if (!isRestrictedMode || !attemptId) return;

      const now = Date.now();
      const lastTs = restrictedEventCooldownRef.current[eventType];
      if (now - lastTs < RESTRICTED_EVENT_COOLDOWN_MS[eventType]) return;
      restrictedEventCooldownRef.current[eventType] = now;

      try {
        await fetch(`/api/attempts/${attemptId}/monitor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eventType, meta }),
          keepalive: true,
        });
      } catch {
        // Silent: monitoring must not break assignment flow.
      }
    },
    [attemptId, isRestrictedMode]
  );

  useEffect(() => {
    return () => {
      if (restrictedNoticeTimerRef.current !== null) {
        window.clearTimeout(restrictedNoticeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isRestrictedMode || !attemptId) return;

    const handleCopy = (event: ClipboardEvent) => {
      const shouldBlock =
        isProtectedElementTarget(event.target) || selectionTouchesProtectedContent();
      if (!shouldBlock) return;

      event.preventDefault();
      void reportRestrictedEvent("COPY_BLOCKED", { channel: "copy" });
      showRestrictedNotice("Copying question text is disabled in restricted mode.");
    };

    const handleCut = (event: ClipboardEvent) => {
      const shouldBlock =
        isProtectedElementTarget(event.target) || selectionTouchesProtectedContent();
      if (!shouldBlock) return;

      event.preventDefault();
      void reportRestrictedEvent("COPY_BLOCKED", { channel: "cut" });
      showRestrictedNotice("Cutting question text is disabled in restricted mode.");
    };

    const handleContextMenu = (event: MouseEvent) => {
      if (!isProtectedElementTarget(event.target)) return;
      event.preventDefault();
      void reportRestrictedEvent("COPY_BLOCKED", { channel: "contextmenu" });
      showRestrictedNotice("Context actions for question text are disabled in restricted mode.");
    };

    const handleSelectStart = (event: Event) => {
      if (!isProtectedElementTarget(event.target)) return;
      event.preventDefault();
    };

    const handleDragStart = (event: DragEvent) => {
      if (!isProtectedElementTarget(event.target)) return;
      event.preventDefault();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      void reportRestrictedEvent("TAB_SWITCH", { visibilityState: document.visibilityState });
      showRestrictedNotice("Switching tabs is logged in restricted mode.");
    };

    const handleWindowBlur = () => {
      void reportRestrictedEvent("WINDOW_BLUR", { reason: "window_blur" });
      showRestrictedNotice("Switching windows is logged in restricted mode.");
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isScreenshotShortcut =
        event.key === "PrintScreen" ||
        ((event.ctrlKey || event.metaKey) && event.shiftKey && ["s", "3", "4", "5"].includes(key));
      if (!isScreenshotShortcut) return;

      event.preventDefault();
      void reportRestrictedEvent("SCREENSHOT_ATTEMPT", {
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      });
      showRestrictedNotice("Screenshot attempts are blocked and logged in restricted mode.");
    };

    document.addEventListener("copy", handleCopy, { capture: true });
    document.addEventListener("cut", handleCut, { capture: true });
    document.addEventListener("contextmenu", handleContextMenu, { capture: true });
    document.addEventListener("selectstart", handleSelectStart, { capture: true });
    document.addEventListener("dragstart", handleDragStart, { capture: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    window.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener("copy", handleCopy, { capture: true });
      document.removeEventListener("cut", handleCut, { capture: true });
      document.removeEventListener("contextmenu", handleContextMenu, { capture: true });
      document.removeEventListener("selectstart", handleSelectStart, { capture: true });
      document.removeEventListener("dragstart", handleDragStart, { capture: true });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [attemptId, isRestrictedMode, reportRestrictedEvent, showRestrictedNotice]);

  useEffect(() => {
    if (!isHelpSidebarOpen || !chatBodyRef.current) return;
    chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [activeChat, isHelpSidebarOpen]);

  useEffect(() => {
    if (unansweredCount === 0) {
      setSubmitConfirm(false);
    }
  }, [unansweredCount]);

  useEffect(() => {
    const questionPane = questionPaneRef.current;
    if (!questionPane) return;

    const updateNavigatorHeight = () => {
      const nextHeight = Math.round(questionPane.getBoundingClientRect().height);
      setNavigatorHeight(nextHeight > 0 ? nextHeight : null);
    };

    updateNavigatorHeight();

    const resizeObserver = new ResizeObserver(() => {
      updateNavigatorHeight();
    });
    resizeObserver.observe(questionPane);
    window.addEventListener("resize", updateNavigatorHeight);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateNavigatorHeight);
    };
  }, [viewMode, currentQuestionOrder, totalQuestions, unansweredCount, answeredCount, isSubmitted]);

  const saveDraft = useCallback(async (): Promise<boolean> => {
    if (savePromiseRef.current) {
      return savePromiseRef.current;
    }
    if (isSubmitted || !attemptId || !isDirty) {
      return true;
    }

    const savePromise = (async () => {
      markSaving();
      try {
        const res = await fetch(`/api/attempts/${attemptId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: getAnswersArray() }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          markSaveError(data.error ?? "Failed to save");
          return false;
        }
        markSaved(data.data.status);
        return true;
      } catch {
        markSaveError("Network error. Please try again.");
        return false;
      } finally {
        savePromiseRef.current = null;
      }
    })();

    savePromiseRef.current = savePromise;
    return savePromise;
  }, [attemptId, getAnswersArray, isDirty, isSubmitted, markSaveError, markSaved, markSaving]);

  useEffect(() => {
    if (isSubmitted || !attemptId || !isDirty) return;
    const timerId = window.setTimeout(() => {
      void saveDraft();
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timerId);
  }, [answers, attemptId, isDirty, isSubmitted, saveDraft]);

  const flushPendingAutosave = useCallback(async (): Promise<boolean> => {
    if (savePromiseRef.current) {
      return savePromiseRef.current;
    }
    if (isSubmitted || !isDirty) {
      return true;
    }
    return saveDraft();
  }, [isDirty, isSubmitted, saveDraft]);

  const moveToQuestion = useCallback(
    async (order: number) => {
      if (!questionOrders.includes(order)) return;
      const canProceed = await flushPendingAutosave();
      if (!canProceed) return;
      setViewMode("QUESTION");
      setCurrentQuestionOrder(order);
      setSubmitConfirm(false);
    },
    [flushPendingAutosave, questionOrders]
  );

  const openReview = useCallback(async () => {
    const canProceed = await flushPendingAutosave();
    if (!canProceed) return;
    setViewMode("REVIEW");
    setSubmitConfirm(false);
  }, [flushPendingAutosave]);

  const handlePrevious = useCallback(async () => {
    if (currentQuestionOrder === null) return;
    const previousOrder = getPreviousQuestionOrder(questionOrders, currentQuestionOrder);
    if (previousOrder === null) return;
    await moveToQuestion(previousOrder);
  }, [currentQuestionOrder, moveToQuestion, questionOrders]);

  const handleNext = useCallback(async () => {
    if (currentQuestionOrder === null) return;
    const nextOrder = getNextQuestionOrder(questionOrders, currentQuestionOrder);
    if (nextOrder === null) {
      await openReview();
      return;
    }
    await moveToQuestion(nextOrder);
  }, [currentQuestionOrder, moveToQuestion, openReview, questionOrders]);

  const handleSubmit = useCallback(async () => {
    const canProceed = await flushPendingAutosave();
    if (!canProceed) {
      markSubmitError("Please resolve save errors before submitting.");
      return;
    }

    if (!attemptId) {
      markSubmitError("Attempt was not initialized.");
      return;
    }

    markSubmitting();
    try {
      const res = await fetch(`/api/attempts/${attemptId}/submit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        markSubmitError(data.error ?? "Failed to submit");
        return;
      }
      markSubmitted();
      setSubmitConfirm(false);
      setViewMode("QUESTION");
    } catch {
      markSubmitError("Network error. Please try again.");
    }
  }, [attemptId, flushPendingAutosave, markSubmitError, markSubmitted, markSubmitting]);

  const handleSubmitRequest = useCallback(async () => {
    const canSubmitNow = canSubmitWithSoftWarning(unansweredCount, submitConfirm);
    if (!canSubmitNow) {
      setSubmitConfirm(true);
      return;
    }
    await handleSubmit();
  }, [handleSubmit, submitConfirm, unansweredCount]);

  const openHelpSidebar = (itemOrder: number) => {
    setActiveHelpItem(itemOrder);
    setIsHelpSidebarOpen(true);
    setHelpQuestion("");
    setHelpError(null);
  };

  const openHelpForCurrentQuestion = () => {
    if (!currentQuestion) return;
    openHelpSidebar(currentQuestion.order);
  };

  const handleAskHelp = async () => {
    if (!helpQuestion.trim() || activeHelpItem === null) return;

    const currentItem = orderedItems.find((item) => item.order === activeHelpItem);
    if (!currentItem) return;

    const question = helpQuestion.trim();
    const itemOrder = activeHelpItem;
    const priorTurns = (helpChats[itemOrder] ?? [])
      .slice(-6)
      .map((turn) => `${turn.role === "student" ? "Student" : "Assistant"}: ${turn.content}`)
      .join("\n");

    const contextualQuestion = [
      `Assignment item ${currentItem.order}: ${currentItem.question}`,
      priorTurns.length > 0 ? `Conversation context:\n${priorTurns}` : "",
      `Student: ${question}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    setHelpChats((prev) => ({
      ...prev,
      [itemOrder]: [...(prev[itemOrder] ?? []), { role: "student", content: question }],
    }));
    setHelpQuestion("");
    setHelpLoading(true);
    setHelpError(null);

    try {
      const res = await fetch("/api/ai-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, question: contextualQuestion }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setHelpError(data.error ?? "Request blocked or failed");
        return;
      }

      setHelpChats((prev) => ({
        ...prev,
        [itemOrder]: [
          ...(prev[itemOrder] ?? []),
          { role: "assistant", content: String(data.data.response ?? "") },
        ],
      }));
    } catch {
      setHelpError("Network error. Please try again.");
    } finally {
      setHelpLoading(false);
    }
  };

  if (totalQuestions === 0) {
    return (
      <div className="space-y-8">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-gray-500">No questions are available in this worksheet.</p>
        </div>
      </div>
    );
  }

  const currentQuestionIndex =
    currentQuestionOrder !== null ? Math.max(questionOrders.indexOf(currentQuestionOrder), 0) : 0;
  const canGoPrevious = currentQuestionIndex > 0;
  const canGoNext = currentQuestionIndex < totalQuestions - 1;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          {initialAttempt.deadline && (
            <span>Due: {new Date(initialAttempt.deadline).toLocaleString()}</span>
          )}
          <span>
            AI Help: <strong className="text-gray-700">{AI_HELP_MODE_LABELS[aiHelpMode]}</strong>
          </span>
          {initialAttempt.isGraded && <span className="text-emerald-300 font-medium">Graded</span>}
          {initialAttempt.distributionStatus === "MANDATORY" && (
            <span className="text-red-600 font-medium">Mandatory</span>
          )}
        </div>
      </div>

      {isSubmitted && (
        <div className="bg-green-50 border border-green-200 rounded p-4 text-sm text-green-800">
          Your submission has been received. This attempt is read-only.
        </div>
      )}

      {isRestrictedMode && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          Restricted mode is active. Question copy, screenshots, and tab/window switches are
          monitored.
        </div>
      )}
      {restrictedNotice && (
        <div className="rounded border p-3 text-sm workspace-accent-surface text-[color:var(--color-blue-100)]">
          {restrictedNotice}
        </div>
      )}

      {aiHelpMode === "NO_HELP" && !isSubmitted && (
        <div className="bg-gray-50 border rounded p-3 text-sm text-gray-600">
          {AI_HELP_MODE_DESCRIPTIONS.NO_HELP}
        </div>
      )}
      {aiHelpMode === "POST_ASSESSMENT" && !isSubmitted && (
        <div className="bg-[color:var(--color-blue-500)]/10 border border-[color:var(--color-blue-500)]/35 rounded p-3 text-sm text-[color:var(--color-blue-200)]">
          {AI_HELP_MODE_DESCRIPTIONS.POST_ASSESSMENT}
        </div>
      )}

      {instructions && (
        <div
          className={`bg-gray-50 rounded-lg p-4 ${isRestrictedMode ? "select-none" : ""}`}
          data-protected-question={isRestrictedMode ? "true" : undefined}
        >
          <h2 className="text-sm font-semibold text-gray-700 mb-1">Instructions</h2>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{instructions}</p>
        </div>
      )}

      <section className="border rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-gray-800">
            {viewMode === "QUESTION" && currentQuestionOrder !== null
              ? `Question ${currentQuestionOrder} of ${totalQuestions}`
              : `Review answers (${totalQuestions} questions)`}
          </p>
          <p className="text-xs text-gray-500">
            Answered {answeredCount}/{totalQuestions} ({completionPercent}%)
          </p>
        </div>
        <div className="h-2 bg-gray-100 rounded">
          <div
            className="h-2 workspace-primary-action rounded transition-all"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
        {!isSubmitted && (
          <div className="text-xs">
            <span className={saveState === "error" ? "text-red-600" : "text-gray-600"}>{saveStatusLabel}</span>
            {saveError && <span className="text-red-600"> - {saveError}</span>}
          </div>
        )}
      </section>

      <div className="lg:hidden overflow-x-auto">
        <div className="flex gap-2 pb-1 min-w-max">
          {navItems.map((navItem) => (
            <button
              key={`mobile-nav-${navItem.order}`}
              type="button"
              onClick={() => void moveToQuestion(navItem.order)}
              disabled={isSubmitting}
              aria-current={navItem.status === "current" ? "step" : undefined}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                navItem.status === "current"
                  ? "workspace-primary-action text-white border-[color:var(--color-blue-600)]"
                  : navItem.status === "answered"
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-slate-950/30 text-gray-700 border-gray-200"
              } disabled:opacity-50`}
            >
              Q{navItem.order}
            </button>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_260px]">
        <div ref={questionPaneRef} className="space-y-4">
          {viewMode === "QUESTION" && currentQuestion && (
            <section className="border rounded-lg p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div
                  className={`space-y-1 ${isRestrictedMode ? "select-none" : ""}`}
                  data-protected-question={isRestrictedMode ? "true" : undefined}
                >
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Q{currentQuestion.order} - {getQuestionTypeLabel(currentQuestion.type)}
                  </p>
                  <p className="text-gray-900 whitespace-pre-wrap">{currentQuestion.question}</p>
                </div>
                {helpEnabled && !isSubmitted && (
                  <button
                    type="button"
                    onClick={openHelpForCurrentQuestion}
                    className="text-xs workspace-themed-link hover:underline shrink-0"
                  >
                    Ask AI
                  </button>
                )}
              </div>

              {currentQuestion.type === "MULTIPLE_CHOICE" && currentQuestion.options && !isSubmitted && (
                <div
                  className={`space-y-2 ${isRestrictedMode ? "select-none" : ""}`}
                  data-protected-question={isRestrictedMode ? "true" : undefined}
                >
                  {currentQuestion.options.map((opt, i) => (
                    <label key={i} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name={`item-${currentQuestion.order}`}
                        value={opt}
                        checked={answers[currentQuestion.order] === opt}
                        onChange={() => setAnswer(currentQuestion.order, opt)}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}

              {currentQuestion.type !== "MULTIPLE_CHOICE" && !isSubmitted && (
                <textarea
                  rows={currentQuestion.type === "LONG_ANSWER" ? 8 : 4}
                  value={answers[currentQuestion.order] ?? ""}
                  onChange={(e) => setAnswer(currentQuestion.order, e.target.value)}
                  placeholder="Enter your answer..."
                  className="w-full border rounded px-3 py-2 text-sm resize-y"
                />
              )}

              {isSubmitted && (
                <div className="bg-gray-50 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap">
                  {answers[currentQuestion.order] || (
                    <span className="text-gray-400 italic">No answer provided</span>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => void handlePrevious()}
                  disabled={!canGoPrevious || isSubmitting}
                  className="px-4 py-2 border rounded text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void openReview()}
                    disabled={isSubmitting}
                    className="px-4 py-2 border rounded text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Go to Review
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleNext()}
                    disabled={isSubmitting}
                    className="px-4 py-2 workspace-primary-action text-white rounded text-sm font-medium  disabled:opacity-50"
                  >
                    {canGoNext ? "Next" : "Review"}
                  </button>
                </div>
              </div>
            </section>
          )}

          {viewMode === "REVIEW" && (
            <section className="border rounded-lg">
              <header className="p-4 border-b bg-gray-50 rounded-t-lg space-y-1">
                <h2 className="text-base font-semibold text-gray-900">Review your answers</h2>
                <p className="text-sm text-gray-600">
                  Answered {answeredCount}/{totalQuestions}. Unanswered: {unansweredCount}.
                </p>
              </header>

              <div className="divide-y">
                {orderedItems.map((item) => {
                  const answerText = answers[item.order] ?? "";
                  const answered = isAnswerFilled(answerText);
                  return (
                    <div key={`review-item-${item.order}`} className="p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">
                          Q{item.order} - {getQuestionTypeLabel(item.type)}
                        </p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            answered ? "bg-green-100 text-green-700" : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {answered ? "Answered" : "Unanswered"}
                        </span>
                      </div>
                      <p
                        className={`text-sm text-gray-700 whitespace-pre-wrap ${
                          isRestrictedMode ? "select-none" : ""
                        }`}
                        data-protected-question={isRestrictedMode ? "true" : undefined}
                      >
                        {item.question}
                      </p>
                      <div className="bg-gray-50 border rounded p-3 text-sm text-gray-700 whitespace-pre-wrap">
                        {answered ? answerText : <span className="text-gray-400 italic">No answer yet</span>}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void moveToQuestion(item.order)}
                          disabled={isSubmitting}
                          className="text-sm workspace-themed-link hover:underline disabled:opacity-50"
                        >
                          Edit question
                        </button>
                        {helpEnabled && !isSubmitted && (
                          <button
                            type="button"
                            onClick={() => openHelpSidebar(item.order)}
                            className="text-sm workspace-themed-link hover:underline"
                          >
                            Ask AI
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {!isSubmitted && (
                <footer className="p-4 border-t space-y-3">
                  {unansweredCount > 0 && (
                    <div className="rounded border p-3 text-sm workspace-accent-surface text-[color:var(--color-blue-100)]">
                      {submitConfirm
                        ? `Submit anyway with ${unansweredCount} unanswered question(s)?`
                        : `You still have ${unansweredCount} unanswered question(s).`}
                    </div>
                  )}
                  {submitError && <p className="text-sm text-red-600">{submitError}</p>}

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => void moveToQuestion(currentQuestionOrder ?? questionOrders[0])}
                      disabled={isSubmitting}
                      className="px-4 py-2 border rounded text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Back to Questions
                    </button>
                    <div className="flex items-center gap-2">
                      {submitConfirm && (
                        <button
                          type="button"
                          onClick={() => setSubmitConfirm(false)}
                          disabled={isSubmitting}
                          className="px-3 py-2 border rounded text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleSubmitRequest()}
                        disabled={isSubmitting || isSaving}
                        className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                      >
                        {isSubmitting
                          ? "Submitting..."
                          : submitConfirm
                          ? "Confirm Submit"
                          : unansweredCount > 0
                          ? "Submit Anyway"
                          : "Submit"}
                      </button>
                    </div>
                  </div>
                </footer>
              )}
            </section>
          )}
        </div>

        <aside className="hidden lg:block">
          <div
            className="border rounded-lg p-4 sticky top-6 flex flex-col gap-3"
            style={navigatorHeight ? { height: `${navigatorHeight}px` } : undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Question navigator</h2>
              {!isSubmitted && (
                <button
                  type="button"
                  onClick={() => void openReview()}
                  className="text-xs workspace-themed-link hover:underline"
                >
                  Review
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              <div className="space-y-2">
                {navItems.map((navItem) => (
                  <button
                    key={`desktop-nav-${navItem.order}`}
                    type="button"
                    onClick={() => void moveToQuestion(navItem.order)}
                    disabled={isSubmitting}
                    aria-current={navItem.status === "current" ? "step" : undefined}
                    className={`w-full text-left px-3 py-2 rounded border text-sm font-medium transition disabled:opacity-50 ${
                      navItem.status === "current"
                        ? "workspace-primary-action text-white border-[color:var(--color-blue-600)]"
                        : navItem.status === "answered"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : "bg-slate-950/30 text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    Question {navItem.order}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Green = answered, white = unanswered, blue = currently open.
            </p>
          </div>
        </aside>
      </div>

      {helpEnabled && !isSubmitted && (
        <>
          {isHelpSidebarOpen && (
            <button
              type="button"
              aria-label="Close AI chat"
              onClick={() => setIsHelpSidebarOpen(false)}
              className="fixed inset-0 bg-black/40 z-40"
            />
          )}
          <aside
            className={`fixed inset-y-0 right-0 w-full max-w-md border-l bg-slate-950/30 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${
              isHelpSidebarOpen ? "translate-x-0" : "translate-x-full pointer-events-none"
            }`}
            aria-hidden={!isHelpSidebarOpen}
          >
            <div className="border-b px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">AI Chat</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {AI_HELP_MODE_LABELS[aiHelpMode]}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHelpSidebarOpen(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>

              <p className="text-xs text-gray-600">{AI_HELP_MODE_DESCRIPTIONS[aiHelpMode]}</p>

              {activeHelpQuestion && (
                <div
                  className={`rounded bg-gray-50 border px-3 py-2 ${
                    isRestrictedMode ? "select-none" : ""
                  }`}
                  data-protected-question={isRestrictedMode ? "true" : undefined}
                >
                  <p className="text-[11px] text-gray-500 uppercase tracking-wide">
                    Question {activeHelpQuestion.order}
                  </p>
                  <p className="text-sm text-gray-800">{activeHelpQuestion.question}</p>
                </div>
              )}
            </div>

            <div ref={chatBodyRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {activeHelpItem === null && (
                <p className="text-sm text-gray-500">
                  Select Ask AI from a question to start chatting.
                </p>
              )}
              {activeHelpItem !== null && activeChat.length === 0 && (
                <p className="text-sm text-gray-500">
                  Ask a question about this item. The assistant will reply based on the allowed help mode.
                </p>
              )}
              {activeChat.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    message.role === "student"
                      ? "ml-auto workspace-primary-action text-white"
                      : "mr-auto bg-gray-100 text-gray-900 border border-gray-200"
                  }`}
                >
                  {message.content}
                </div>
              ))}
              {helpLoading && (
                <div className="mr-auto bg-gray-100 text-gray-600 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  AI is thinking...
                </div>
              )}
            </div>

            <div className="border-t p-4 space-y-2">
              {helpError && <p className="text-xs text-red-600">{helpError}</p>}
              <textarea
                rows={3}
                value={helpQuestion}
                onChange={(e) => setHelpQuestion(e.target.value)}
                placeholder={
                  activeHelpItem === null ? "Pick a question first" : "Ask for clarification or guided help"
                }
                disabled={activeHelpItem === null || helpLoading}
                className="w-full border rounded px-3 py-2 text-sm resize-none disabled:bg-gray-50 disabled:text-gray-500"
              />
              <button
                type="button"
                onClick={handleAskHelp}
                disabled={helpLoading || !helpQuestion.trim() || activeHelpItem === null}
                className="w-full px-3 py-2 workspace-primary-action text-white rounded text-sm font-medium  disabled:opacity-50"
              >
                {helpLoading ? "Sending..." : "Send"}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
