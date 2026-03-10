"use client";

import { create } from "zustand";
import type { AttemptAnswer, AttemptStatus } from "./types";

interface WorkspaceState {
  attemptId: string | null;
  status: AttemptStatus | null;
  answers: Record<number, string>; // itemOrder -> text
  isDirty: boolean;
  isSaving: boolean;
  isSubmitting: boolean;
  saveError: string | null;
  submitError: string | null;
  saveState: "idle" | "dirty" | "saving" | "saved" | "error";
  lastSavedAt: number | null;
  hasPendingAutosave: boolean;
}

interface WorkspaceActions {
  load: (attemptId: string, status: AttemptStatus, answers: AttemptAnswer[]) => void;
  setAnswer: (itemOrder: number, text: string) => void;
  markSaving: () => void;
  markSaved: (status: AttemptStatus) => void;
  markSaveError: (error: string) => void;
  markSubmitting: () => void;
  markSubmitted: () => void;
  markSubmitError: (error: string) => void;
  getAnswersArray: () => AttemptAnswer[];
  reset: () => void;
}

const emptyState: WorkspaceState = {
  attemptId: null,
  status: null,
  answers: {},
  isDirty: false,
  isSaving: false,
  isSubmitting: false,
  saveError: null,
  submitError: null,
  saveState: "idle",
  lastSavedAt: null,
  hasPendingAutosave: false,
};

export const useWorkspaceStore = create<WorkspaceState & WorkspaceActions>((set, get) => ({
  ...emptyState,

  load: (attemptId, status, answers) => {
    const answersMap: Record<number, string> = {};
    for (const a of answers) {
      answersMap[a.itemOrder] = a.text;
    }
    set({
      attemptId,
      status,
      answers: answersMap,
      isDirty: false,
      saveError: null,
      submitError: null,
      saveState: "idle",
      lastSavedAt: null,
      hasPendingAutosave: false,
    });
  },

  setAnswer: (itemOrder, text) =>
    set((s) => ({
      answers: { ...s.answers, [itemOrder]: text },
      isDirty: true,
      saveError: null,
      saveState: "dirty",
      hasPendingAutosave: true,
    })),

  markSaving: () => set({ isSaving: true, saveError: null, saveState: "saving", hasPendingAutosave: true }),

  markSaved: (status) =>
    set({
      isSaving: false,
      isDirty: false,
      status,
      saveError: null,
      saveState: "saved",
      lastSavedAt: Date.now(),
      hasPendingAutosave: false,
    }),

  markSaveError: (error) =>
    set({
      isSaving: false,
      saveError: error,
      saveState: "error",
      hasPendingAutosave: true,
    }),

  markSubmitting: () => set({ isSubmitting: true, submitError: null }),

  markSubmitted: () =>
    set({
      isSubmitting: false,
      status: "SUBMITTED",
      isDirty: false,
      saveState: "saved",
      hasPendingAutosave: false,
    }),

  markSubmitError: (error) => set({ isSubmitting: false, submitError: error }),

  getAnswersArray: () => {
    const { answers } = get();
    return Object.entries(answers)
      .map(([order, text]) => ({
        itemOrder: Number(order),
        text,
      }))
      .sort((a, b) => a.itemOrder - b.itemOrder);
  },

  reset: () => set(emptyState),
}));
