"use client";

import { create } from "zustand";
import type { AssignmentContent, AssignmentItemContent } from "./types";

interface EditorState {
  assignmentId: string | null;
  content: AssignmentContent;
  isDirty: boolean;
  isSaving: boolean;
  saveError: string | null;
}

interface EditorActions {
  load: (assignmentId: string, content: AssignmentContent) => void;
  setTitle: (title: string) => void;
  setInstructions: (instructions: string) => void;
  updateItem: (order: number, patch: Partial<AssignmentItemContent>) => void;
  addItem: (item: AssignmentItemContent) => void;
  removeItem: (order: number) => void;
  moveItem: (order: number, direction: "up" | "down") => void;
  markSaving: () => void;
  markSaved: () => void;
  markSaveError: (error: string) => void;
  reset: () => void;
}

const emptyContent: AssignmentContent = {
  title: "",
  instructions: "",
  items: [],
};

export const useEditorStore = create<EditorState & EditorActions>((set, get) => ({
  assignmentId: null,
  content: emptyContent,
  isDirty: false,
  isSaving: false,
  saveError: null,

  load: (assignmentId, content) =>
    set({ assignmentId, content, isDirty: false, isSaving: false, saveError: null }),

  setTitle: (title) =>
    set((s) => ({ content: { ...s.content, title }, isDirty: true })),

  setInstructions: (instructions) =>
    set((s) => ({ content: { ...s.content, instructions }, isDirty: true })),

  updateItem: (order, patch) =>
    set((s) => ({
      content: {
        ...s.content,
        items: s.content.items.map((item) =>
          item.order === order ? { ...item, ...patch } : item
        ),
      },
      isDirty: true,
    })),

  addItem: (item) =>
    set((s) => ({
      content: { ...s.content, items: [...s.content.items, item] },
      isDirty: true,
    })),

  removeItem: (order) =>
    set((s) => {
      const filtered = s.content.items
        .filter((item) => item.order !== order)
        .map((item, idx) => ({ ...item, order: idx + 1 }));
      return { content: { ...s.content, items: filtered }, isDirty: true };
    }),

  moveItem: (order, direction) =>
    set((s) => {
      const items = [...s.content.items].sort((a, b) => a.order - b.order);
      const idx = items.findIndex((item) => item.order === order);
      if (idx === -1) return {};
      const targetIdx = direction === "up" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= items.length) return {};
      [items[idx], items[targetIdx]] = [items[targetIdx], items[idx]];
      const reordered = items.map((item, i) => ({ ...item, order: i + 1 }));
      return { content: { ...s.content, items: reordered }, isDirty: true };
    }),

  markSaving: () => set({ isSaving: true, saveError: null }),
  markSaved: () => set({ isSaving: false, isDirty: false, saveError: null }),
  markSaveError: (error) => set({ isSaving: false, saveError: error }),

  reset: () =>
    set({
      assignmentId: null,
      content: emptyContent,
      isDirty: false,
      isSaving: false,
      saveError: null,
    }),
}));
