import { describe, it, expect } from "vitest";
import { buildTemplatePayload, buildTemplateComponents, countTemplateVars } from "./whatsapp";

describe("buildTemplatePayload", () => {
  // POSITIVE: template with body variables
  it("includes body components when params are provided", () => {
    const p = buildTemplatePayload({
      to: "966500000000",
      templateName: "promo_offer",
      language: "ar",
      bodyParams: ["Laglag", "20%"],
    });
    expect(p.messaging_product).toBe("whatsapp");
    expect(p.to).toBe("966500000000");
    expect(p.template.name).toBe("promo_offer");
    expect(p.template.language.code).toBe("ar");
    // @ts-expect-error narrowing for test
    expect(p.template.components[0].parameters).toHaveLength(2);
    // @ts-expect-error narrowing for test
    expect(p.template.components[0].parameters[1].text).toBe("20%");
  });

  // NEGATIVE: template with no variables must omit components entirely
  // (Meta rejects an empty components array).
  it("omits components when there are no params", () => {
    const p = buildTemplatePayload({
      to: "966500000000",
      templateName: "welcome",
      language: "en",
      bodyParams: [],
    });
    expect("components" in p.template).toBe(false);
  });
});

describe("buildTemplateComponents", () => {
  // POSITIVE: body with a variable gets an example row; footer + buttons map through
  it("builds body example, footer, and buttons", () => {
    const c = buildTemplateComponents({
      name: "today_menu", language: "ar", category: "MARKETING",
      body: "Hello {{1}}, the menu is ready!",
      bodyExamples: ["Ahmed"],
      footer: "Reply STOP to opt out",
      buttons: [{ type: "QUICK_REPLY", text: "View menu" }, { type: "URL", text: "Order", url: "https://x.co" }],
    });
    const body = c.find((x) => x.type === "BODY") as { example?: { body_text: string[][] } };
    expect(body.example).toEqual({ body_text: [["Ahmed"]] });
    expect(c.find((x) => x.type === "FOOTER")).toEqual({ type: "FOOTER", text: "Reply STOP to opt out" });
    const buttons = c.find((x) => x.type === "BUTTONS") as { buttons: unknown[] };
    expect(buttons.buttons[1]).toEqual({ type: "URL", text: "Order", url: "https://x.co" });
  });

  // NEGATIVE: a body with no variables must omit the example object
  it("omits the example when there are no variables", () => {
    const c = buildTemplateComponents({
      name: "welcome", language: "en", category: "UTILITY",
      body: "Welcome aboard.", bodyExamples: [], buttons: [],
    });
    expect(countTemplateVars("Welcome aboard.")).toBe(0);
    expect("example" in (c[0] as object)).toBe(false);
  });
});
