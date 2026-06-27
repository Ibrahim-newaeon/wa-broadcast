import { describe, it, expect } from "vitest";
import { buildTemplatePayload } from "./whatsapp";

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
