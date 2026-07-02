import { describe, it, expect } from "vitest";
import { PhoneSchema, ContactRowSchema, CreateContactSchema, composeName, CreateClientSchema, CreateTemplateSchema, LeadSchema } from "./validation";

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
