import { describe, it, expect } from "vitest";
import { PhoneSchema, ContactRowSchema, CreateContactSchema, composeName, CreateClientSchema, CreateTemplateSchema, LeadSchema, TemplatePhoneSchema } from "./validation";

describe("TemplatePhoneSchema", () => {
  it("keeps a number that is already E.164", () => {
    expect(TemplatePhoneSchema.parse("+962798960079")).toBe("+962798960079");
  });

  it("strips the spaces, dashes and brackets people type", () => {
    expect(TemplatePhoneSchema.parse(" +962 (79) 896-0079 ")).toBe("+962798960079");
  });

  it("adds the + when only the country code is given", () => {
    expect(TemplatePhoneSchema.parse("962798960079")).toBe("+962798960079");
  });

  it("converts a 00 international prefix to +", () => {
    expect(TemplatePhoneSchema.parse("00962798960079")).toBe("+962798960079");
  });

  // The whole point: Meta answers each of these with error #192, and only after review.
  it("rejects a national number with a leading 0 and no country code", () => {
    expect(TemplatePhoneSchema.safeParse("0798960079").success).toBe(false);
  });

  it("rejects a leading 0 after the +, which no country code has", () => {
    expect(TemplatePhoneSchema.safeParse("+0798960079").success).toBe(false);
  });

  it("rejects a number too short or too long for E.164", () => {
    expect(TemplatePhoneSchema.safeParse("+96279").success).toBe(false);
    expect(TemplatePhoneSchema.safeParse("+9627989600791234").success).toBe(false);
  });

  it("rejects letters and empty input", () => {
    expect(TemplatePhoneSchema.safeParse("+962CALLME").success).toBe(false);
    expect(TemplatePhoneSchema.safeParse("").success).toBe(false);
  });

  it("normalizes the number a Call button submits", () => {
    const t = CreateTemplateSchema.parse({
      name: "call_us",
      language: "ar",
      category: "MARKETING",
      body: "Tap to call",
      buttons: [{ type: "PHONE_NUMBER", text: "Call us", phoneNumber: "00962 79 896 0079" }],
    });
    expect(t.buttons[0]?.phoneNumber).toBe("+962798960079");
  });

  it("rejects a template whose Call button carries a national number", () => {
    expect(
      CreateTemplateSchema.safeParse({
        name: "call_us",
        language: "ar",
        category: "MARKETING",
        body: "Tap to call",
        buttons: [{ type: "PHONE_NUMBER", text: "Call us", phoneNumber: "0798960079" }],
      }).success,
    ).toBe(false);
  });
});

describe("PhoneSchema", () => {
  it("normalizes +966 50 000 0000 → 966500000000", () => {
    expect(PhoneSchema.parse("+966 50 000 0000")).toBe("966500000000");
  });
  it("rejects too-short numbers", () => {
    expect(PhoneSchema.safeParse("123").success).toBe(false);
  });
  it("rejects letters", () => {
    expect(PhoneSchema.safeParse("96650ABCDEF0").success).toBe(false);
  });
});

describe("ContactRowSchema", () => {
  it("accepts a valid row and defaults attributes", () => {
    const r = ContactRowSchema.parse({ phone: "96650000000", name: "Laglag" });
    expect(r.attributes).toEqual({});
  });
  it("rejects a row with an invalid phone", () => {
    expect(ContactRowSchema.safeParse({ phone: "nope" }).success).toBe(false);
  });
});

describe("composeName", () => {
  it("joins first and last", () => {
    expect(composeName("Ahmed", "Al-Saud")).toBe("Ahmed Al-Saud");
  });
  it("returns just the first name when last is blank", () => {
    expect(composeName("Ahmed", "  ")).toBe("Ahmed");
  });
  it("returns undefined when both are empty", () => {
    expect(composeName(undefined, null)).toBeUndefined();
  });
});

describe("CreateClientSchema", () => {
  it("accepts a name with no admin login", () => {
    const r = CreateClientSchema.parse({ name: "Acme Cafe" });
    expect(r.name).toBe("Acme Cafe");
    expect(r.adminEmail).toBeUndefined();
  });
  it("accepts an optional admin email + password", () => {
    const r = CreateClientSchema.parse({ name: "Acme", adminEmail: "owner@acme.com", adminPassword: "longenough1" });
    expect(r.adminEmail).toBe("owner@acme.com");
  });
  it("rejects an invalid admin email", () => {
    expect(CreateClientSchema.safeParse({ name: "Acme", adminEmail: "not-an-email" }).success).toBe(false);
  });
  it("rejects an admin password shorter than 8 chars", () => {
    expect(CreateClientSchema.safeParse({ name: "Acme", adminEmail: "owner@acme.com", adminPassword: "short" }).success).toBe(false);
  });
});

describe("CreateTemplateSchema — limited-time offer", () => {
  const base = {
    name: "flash_sale",
    language: "en",
    category: "MARKETING" as const,
    body: "Ends soon!",
    bodyExamples: [],
    limitedTimeOffer: { text: "Expiring offer!", hasExpiration: true },
  };
  const urlBtn = { type: "URL" as const, text: "Shop", url: "https://x.co" };

  it("accepts an LTO with a URL button", () => {
    const r = CreateTemplateSchema.safeParse({ ...base, buttons: [urlBtn] });
    expect(r.success).toBe(true);
  });
  it("rejects an LTO without a URL button", () => {
    expect(CreateTemplateSchema.safeParse({ ...base, buttons: [] }).success).toBe(false);
  });
  it("rejects quick-reply buttons on an LTO", () => {
    expect(
      CreateTemplateSchema.safeParse({ ...base, buttons: [urlBtn, { type: "QUICK_REPLY", text: "Hi" }] }).success,
    ).toBe(false);
  });
  it("rejects a footer on an LTO", () => {
    expect(CreateTemplateSchema.safeParse({ ...base, buttons: [urlBtn], footer: "STOP to opt out" }).success).toBe(false);
  });
  it("rejects a document header on an LTO", () => {
    expect(
      CreateTemplateSchema.safeParse({ ...base, buttons: [urlBtn], header: { format: "DOCUMENT", example: "h" } }).success,
    ).toBe(false);
  });
  it("rejects offer text longer than 16 characters", () => {
    expect(
      CreateTemplateSchema.safeParse({
        ...base,
        buttons: [urlBtn],
        limitedTimeOffer: { text: "This offer text is way too long", hasExpiration: false },
      }).success,
    ).toBe(false);
  });
});

describe("LeadSchema", () => {
  it("accepts a lead and normalizes the phone", () => {
    const r = LeadSchema.parse({ name: "Ahmed", phone: "+966 50 000 0000", business: "Cafe Nour" });
    expect(r.phone).toBe("966500000000");
    expect(r.business).toBe("Cafe Nour");
  });
  it("keeps the honeypot field so the route can inspect it", () => {
    const r = LeadSchema.parse({ name: "Bot", phone: "966500000000", website: "spam.example" });
    expect(r.website).toBe("spam.example");
  });
  it("rejects a missing name", () => {
    expect(LeadSchema.safeParse({ phone: "966500000000" }).success).toBe(false);
  });
  it("rejects an invalid phone", () => {
    expect(LeadSchema.safeParse({ name: "Ahmed", phone: "12" }).success).toBe(false);
  });
});

describe("CreateContactSchema", () => {
  it("accepts a valid contact and normalizes the phone", () => {
    const r = CreateContactSchema.parse({ firstName: "Ahmed", phone: "+966 50 000 0001" });
    expect(r.firstName).toBe("Ahmed");
    expect(r.phone).toBe("966500000001");
    expect(r.attributes).toEqual({});
  });
  it("rejects a missing first name", () => {
    expect(CreateContactSchema.safeParse({ phone: "966500000001" }).success).toBe(false);
  });
  it("rejects an invalid phone", () => {
    expect(CreateContactSchema.safeParse({ firstName: "Ahmed", phone: "123" }).success).toBe(false);
  });
});
