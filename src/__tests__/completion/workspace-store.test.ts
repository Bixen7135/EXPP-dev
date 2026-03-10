import { describe, expect, it } from "vitest";
import { useWorkspaceStore } from "@/modules/completion/workspace-store";

describe("workspace store", () => {
  it("tracks autosave metadata through save lifecycle", () => {
    const store = useWorkspaceStore.getState();
    store.reset();

    store.load("att_1", "DRAFT", []);
    let state = useWorkspaceStore.getState();
    expect(state.saveState).toBe("idle");
    expect(state.hasPendingAutosave).toBe(false);

    state.setAnswer(2, "B");
    state = useWorkspaceStore.getState();
    expect(state.isDirty).toBe(true);
    expect(state.saveState).toBe("dirty");
    expect(state.hasPendingAutosave).toBe(true);

    state.markSaving();
    state = useWorkspaceStore.getState();
    expect(state.saveState).toBe("saving");
    expect(state.isSaving).toBe(true);

    state.markSaved("DRAFT");
    state = useWorkspaceStore.getState();
    expect(state.isDirty).toBe(false);
    expect(state.saveState).toBe("saved");
    expect(state.lastSavedAt).not.toBeNull();
    expect(state.hasPendingAutosave).toBe(false);
  });

  it("keeps pending autosave true on save error", () => {
    const store = useWorkspaceStore.getState();
    store.reset();
    store.load("att_2", "DRAFT", []);
    store.setAnswer(1, "A");
    store.markSaveError("Failed");

    const state = useWorkspaceStore.getState();
    expect(state.saveState).toBe("error");
    expect(state.hasPendingAutosave).toBe(true);
    expect(state.saveError).toBe("Failed");
  });

  it("returns answers sorted by item order", () => {
    const store = useWorkspaceStore.getState();
    store.reset();
    store.load("att_3", "DRAFT", []);
    store.setAnswer(10, "late");
    store.setAnswer(1, "early");

    const answers = useWorkspaceStore.getState().getAnswersArray();
    expect(answers).toEqual([
      { itemOrder: 1, text: "early" },
      { itemOrder: 10, text: "late" },
    ]);
  });
});
