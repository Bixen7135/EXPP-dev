import { describe, it, expect } from "vitest";
import { checkHelpPolicy, validateDistributionMode } from "@/modules/ai-help/policy-engine";

// ── checkHelpPolicy ───────────────────────────────────────────────────────

describe("checkHelpPolicy — NO_HELP mode", () => {
  it("blocks before submission (mandatory graded)", () => {
    const result = checkHelpPolicy({
      mode: "NO_HELP",
      isMandatory: true,
      isGraded: true,
      attemptStatus: "DRAFT",
    });
    expect(result.allowed).toBe(false);
    expect(result.blockReason).toMatch(/disabled/i);
  });

  it("blocks after submission", () => {
    const result = checkHelpPolicy({
      mode: "NO_HELP",
      isMandatory: false,
      isGraded: false,
      attemptStatus: "SUBMITTED",
    });
    expect(result.allowed).toBe(false);
  });
});

describe("checkHelpPolicy — POST_ASSESSMENT mode", () => {
  it("blocks before submission (Phase 5: publication not yet available)", () => {
    const result = checkHelpPolicy({
      mode: "POST_ASSESSMENT",
      isMandatory: false,
      isGraded: false,
      attemptStatus: "DRAFT",
    });
    expect(result.allowed).toBe(false);
    expect(result.blockReason).toMatch(/not yet available/i);
  });

  it("blocks after submission when result not published", () => {
    const result = checkHelpPolicy({
      mode: "POST_ASSESSMENT",
      isMandatory: false,
      isGraded: false,
      attemptStatus: "SUBMITTED",
      resultPublished: false,
    });
    expect(result.allowed).toBe(false);
  });

  it("allows after result is published (Phase 6)", () => {
    const result = checkHelpPolicy({
      mode: "POST_ASSESSMENT",
      isMandatory: false,
      isGraded: false,
      attemptStatus: "SUBMITTED",
      resultPublished: true,
    });
    expect(result.allowed).toBe(true);
  });
});

describe("checkHelpPolicy — CLARIFICATION mode", () => {
  it("allows before submission", () => {
    const result = checkHelpPolicy({
      mode: "CLARIFICATION",
      isMandatory: true,
      isGraded: true,
      attemptStatus: "DRAFT",
    });
    expect(result.allowed).toBe(true);
  });

  it("blocks after submission", () => {
    const result = checkHelpPolicy({
      mode: "CLARIFICATION",
      isMandatory: true,
      isGraded: true,
      attemptStatus: "SUBMITTED",
    });
    expect(result.allowed).toBe(false);
    expect(result.blockReason).toMatch(/submitted/i);
  });
});

describe("checkHelpPolicy — GUIDED mode", () => {
  it("allows before submission for practice assignment", () => {
    const result = checkHelpPolicy({
      mode: "GUIDED",
      isMandatory: false,
      isGraded: false,
      attemptStatus: "DRAFT",
    });
    expect(result.allowed).toBe(true);
  });

  it("blocks after submission", () => {
    const result = checkHelpPolicy({
      mode: "GUIDED",
      isMandatory: false,
      isGraded: false,
      attemptStatus: "SUBMITTED",
    });
    expect(result.allowed).toBe(false);
  });
});

// ── validateDistributionMode ──────────────────────────────────────────────

describe("validateDistributionMode — mandatory graded restrictions", () => {
  it("allows NO_HELP for mandatory graded", () => {
    expect(validateDistributionMode("NO_HELP", true, true).valid).toBe(true);
  });

  it("allows CLARIFICATION for mandatory graded", () => {
    expect(validateDistributionMode("CLARIFICATION", true, true).valid).toBe(true);
  });

  it("rejects GUIDED for mandatory graded", () => {
    const result = validateDistributionMode("GUIDED", true, true);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/GUIDED/);
  });

  it("rejects POST_ASSESSMENT for mandatory graded", () => {
    const result = validateDistributionMode("POST_ASSESSMENT", true, true);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/POST_ASSESSMENT/);
  });

  it("allows GUIDED for practice assignment (non-mandatory)", () => {
    expect(validateDistributionMode("GUIDED", false, true).valid).toBe(true);
  });

  it("allows GUIDED for ungraded mandatory assignment", () => {
    expect(validateDistributionMode("GUIDED", true, false).valid).toBe(true);
  });

  it("allows POST_ASSESSMENT for practice ungraded", () => {
    expect(validateDistributionMode("POST_ASSESSMENT", false, false).valid).toBe(true);
  });
});
