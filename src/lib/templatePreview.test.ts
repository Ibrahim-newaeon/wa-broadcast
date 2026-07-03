import { describe, it, expect } from "vitest";
import { substituteTemplateVars, previewVarValue } from "./templatePreview";

describe("substituteTemplateVars", () => {
  // POSITIVE: values land in their numbered slots
  it("replaces {{n}} placeholders with the matching values", () => {
    expect(substituteTemplateVars("Hi {{1}}, get {{2}} off!", ["Ahmed", "20%"])).toBe("Hi Ahmed, get 20% off!");
  });

  // POSITIVE: the same placeholder can repeat
  it("replaces repeated placeholders everywhere they appear", () => {
    expect(substituteTemplateVars("{{1}} + {{1}}", ["a"])).toBe("a + a");
  });

  // NEGATIVE: missing/blank values keep the placeholder visible
  it("keeps the placeholder when the value is missing or blank", () => {
    expect(substituteTemplateVars("Hi {{1}}, {{2}}!", ["", undefined])).toBe("Hi {{1}}, {{2}}!");
    expect(substituteTemplateVars("Hi {{3}}", ["a", "b"])).toBe("Hi {{3}}");
  });

  // NEGATIVE: a body with no placeholders passes through untouched
  it("leaves a body without placeholders unchanged", () => {
    expect(substituteTemplateVars("Welcome aboard.", [])).toBe("Welcome aboard.");
  });
});

describe("previewVarValue", () => {
  it("shows literals as-is", () => {
    expect(previewVarValue("20% off")).toBe("20% off");
  });

  it("shows field mappings as a ⟨field⟩ token", () => {
    expect(previewVarValue("field:name")).toBe("⟨name⟩");
    expect(previewVarValue("field: city ")).toBe("⟨city⟩");
  });

  // NEGATIVE: blank input stays blank (placeholder survives substitution)
  it("returns empty for blank input and a fallback token for a bare field:", () => {
    expect(previewVarValue("   ")).toBe("");
    expect(previewVarValue("field:")).toBe("⟨field⟩");
  });
});
