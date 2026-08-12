import { describe, it, expect } from "vitest";
import {
  substituteTemplateVars, previewVarValue, buildTemplatePreview, type TemplateDraft,
} from "./templatePreview";

const draft = (over: Partial<TemplateDraft> = {}): TemplateDraft => ({
  body: "Hello", examples: [], footer: "", headerFormat: "", headerFile: "",
  buttons: [], carouselOn: false, cards: [], ltoOn: false, ltoText: "",
  ...over,
});

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

describe("buildTemplatePreview", () => {
  // POSITIVE: variables render with the example values Meta will review
  it("fills {{n}} with the operator's example values", () => {
    const p = buildTemplatePreview(draft({ body: "Hi {{1}}, see {{2}}", examples: ["Ahmed", "the menu"] }));
    expect(p.body).toBe("Hi Ahmed, see the menu");
  });

  // NEGATIVE: a forgotten example must stay visible, not silently vanish
  it("keeps the placeholder when an example is missing", () => {
    expect(buildTemplatePreview(draft({ body: "Hi {{1}}", examples: [] })).body).toBe("Hi {{1}}");
    expect(buildTemplatePreview(draft({ body: "Hi {{1}}", examples: ["  "] })).body).toBe("Hi {{1}}");
  });

  it("shows the header format and the attached sample's filename", () => {
    const p = buildTemplatePreview(draft({ headerFormat: "IMAGE", headerFile: "menu.png" }));
    expect(p.headerFormat).toBe("IMAGE");
    expect(p.headerLabel).toBe("menu.png");
  });

  it("prompts for a sample when the header has no file yet", () => {
    expect(buildTemplatePreview(draft({ headerFormat: "VIDEO" })).headerLabel)
      .toBe("video header — attach a sample above");
  });

  // Meta's rule: a carousel replaces the top-level header and buttons
  it("drops the header and buttons when carousel is on", () => {
    const p = buildTemplatePreview(draft({
      carouselOn: true,
      headerFormat: "IMAGE",
      headerFile: "x.png",
      buttons: [{ type: "URL", text: "Open", url: "https://e.com", phoneNumber: "", couponExample: "" }],
      cards: [{ format: "IMAGE", mediaUrl: "https://cdn.test/a/one.jpg", body: "Card one", buttonText: "Buy", buttonUrl: "" }],
    }));
    expect(p.headerFormat).toBeNull();
    expect(p.buttons).toEqual([]);
    expect(p.cards).toEqual([{ format: "IMAGE", body: "Card one", buttonText: "Buy", mediaLabel: "one.jpg" }]);
  });

  it("labels a card with no media yet", () => {
    const p = buildTemplatePreview(draft({
      carouselOn: true,
      cards: [{ format: "VIDEO", mediaUrl: "  ", body: "", buttonText: "", buttonUrl: "" }],
    }));
    expect(p.cards?.[0]).toEqual({ format: "VIDEO", body: undefined, buttonText: undefined, mediaLabel: "no media yet" });
  });

  // Meta's rule: limited-time offer templates have no footer
  it("suppresses the footer for a limited-time offer and defaults the banner text", () => {
    const p = buildTemplatePreview(draft({ ltoOn: true, footer: "Reply STOP" }));
    expect(p.footer).toBeNull();
    expect(p.ltoText).toBe("Expiring offer!");
  });

  it("keeps the footer on an ordinary template", () => {
    expect(buildTemplatePreview(draft({ footer: " Reply STOP " })).footer).toBe("Reply STOP");
    expect(buildTemplatePreview(draft({ footer: "   " })).footer).toBeNull();
  });

  // A copy-code button shows the coupon itself — that's what gets tapped
  it("renders a copy-code button as its sample coupon", () => {
    const p = buildTemplatePreview(draft({
      buttons: [{ type: "COPY_CODE", text: "ignored", url: "", phoneNumber: "", couponExample: " SAVE20 " }],
    }));
    expect(p.buttons).toEqual([{ type: "COPY_CODE", text: "SAVE20" }]);
  });

  it("falls back to a type-appropriate label for an untitled button", () => {
    const p = buildTemplatePreview(draft({
      buttons: [
        { type: "URL", text: "", url: "", phoneNumber: "", couponExample: "" },
        { type: "PHONE_NUMBER", text: "", url: "", phoneNumber: "", couponExample: "" },
        { type: "QUICK_REPLY", text: "", url: "", phoneNumber: "", couponExample: "" },
      ],
    }));
    expect(p.buttons.map((b) => b.text)).toEqual(["Link", "Call", "Button"]);
  });
});
