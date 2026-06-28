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
  it("includes a media header component when the template has one", () => {
    const p = buildTemplatePayload({
      to: "+15551230000", templateName: "menu_pdf", language: "ar",
      bodyParams: ["Ahmed"], headerFormat: "DOCUMENT", headerMediaUrl: "https://cdn.x/menu.pdf",
    });
    const comps = (p.template as { components?: Record<string, unknown>[] }).components ?? [];
    expect(comps[0]).toEqual({ type: "header", parameters: [{ type: "document", document: { link: "https://cdn.x/menu.pdf" } }] });
    expect(comps[1]).toMatchObject({ type: "body" });
  });

  it("adds a copy-code button parameter when a coupon code is supplied", () => {
    const p = buildTemplatePayload({
      to: "15551230000", templateName: "summer_coupon", language: "en",
      bodyParams: ["Sarah"], couponCode: "SAVE20",
    });
    const comps = (p.template as { components?: Record<string, unknown>[] }).components ?? [];
    expect(comps).toContainEqual({
      type: "button", sub_type: "copy_code", index: "0",
      parameters: [{ type: "coupon_code", coupon_code: "SAVE20" }],
    });
  });

  it("builds a carousel send component with each card's media (header only)", () => {
    const p = buildTemplatePayload({
      to: "15551230000", templateName: "lookbook", language: "en", bodyParams: ["Sarah"],
      carouselCards: [
        { format: "IMAGE", mediaUrl: "https://x.co/a.jpg" },
        { format: "VIDEO", mediaUrl: "https://x.co/b.mp4" },
      ],
    });
    const comps = (p.template as { components?: Record<string, unknown>[] }).components ?? [];
    const carousel = comps.find((c) => c.type === "carousel") as { cards: { card_index: number; components: unknown[] }[] };
    expect(carousel.cards[0]).toEqual({
      card_index: 0,
      components: [{ type: "header", parameters: [{ type: "image", image: { link: "https://x.co/a.jpg" } }] }],
    });
    expect(carousel.cards[1]!.components[0]).toEqual({ type: "header", parameters: [{ type: "video", video: { link: "https://x.co/b.mp4" } }] });
  });

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

  // POSITIVE: media header (attachment) + a call (phone) button map to Meta shape
  it("builds a media header and a phone-number button", () => {
    const c = buildTemplateComponents({
      name: "menu_pdf", language: "ar", category: "MARKETING",
      header: { format: "DOCUMENT", example: "https://cdn.example.com/menu.pdf" },
      body: "Today's menu is attached.",
      bodyExamples: [],
      buttons: [{ type: "PHONE_NUMBER", text: "Call us", phoneNumber: "+15551234567" }],
    });
    expect(c[0]).toEqual({
      type: "HEADER",
      format: "DOCUMENT",
      example: { header_handle: ["https://cdn.example.com/menu.pdf"] },
    });
    const buttons = c.find((x) => x.type === "BUTTONS") as { buttons: unknown[] };
    expect(buttons.buttons[0]).toEqual({ type: "PHONE_NUMBER", text: "Call us", phone_number: "+15551234567" });
  });

  // POSITIVE: a copy-code (coupon) button maps to Meta's COPY_CODE shape with an example
  it("builds a copy-code (coupon) button with a sample code", () => {
    const c = buildTemplateComponents({
      name: "summer_coupon", language: "en", category: "MARKETING",
      body: "Here's your discount, {{1}}!", bodyExamples: ["Sarah"],
      buttons: [{ type: "COPY_CODE", text: "Copy code", couponExample: "SAVE20" }],
    });
    const buttons = c.find((x) => x.type === "BUTTONS") as { buttons: unknown[] };
    expect(buttons.buttons[0]).toEqual({ type: "COPY_CODE", example: "SAVE20" });
  });

  // POSITIVE: a carousel builds a CAROUSEL component; cards carry header+body (+optional button)
  it("builds a carousel template with cards", () => {
    const c = buildTemplateComponents({
      name: "lookbook", language: "en", category: "MARKETING",
      body: "New arrivals, {{1}}!", bodyExamples: ["Sarah"], buttons: [],
      carousel: { cards: [
        { format: "IMAGE", example: "h1", body: "Summer dress", buttonText: "Shop", buttonUrl: "https://x.co/1" },
        { format: "IMAGE", example: "h2", body: "Sun hat" },
      ] },
    });
    const carousel = c.find((x) => x.type === "CAROUSEL") as { cards: { components: { type: string }[] }[] };
    expect(carousel.cards).toHaveLength(2);
    expect(carousel.cards[0]!.components[0]).toEqual({ type: "HEADER", format: "IMAGE", example: { header_handle: ["h1"] } });
    expect(carousel.cards[0]!.components[1]).toEqual({ type: "BODY", text: "Summer dress" });
    expect(carousel.cards[0]!.components[2]).toEqual({ type: "BUTTONS", buttons: [{ type: "URL", text: "Shop", url: "https://x.co/1" }] });
    expect(carousel.cards[1]!.components).toHaveLength(2); // no button on card 2
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
