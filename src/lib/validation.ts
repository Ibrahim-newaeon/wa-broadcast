import { z } from "zod";

// E.164 without leading '+', 8–15 digits (covers KSA/Kuwait/Qatar/Jordan, etc.)
export const PhoneSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[^\d]/g, "")) // strip +, spaces, dashes
  .pipe(z.string().regex(/^\d{8,15}$/, "Phone must be 8–15 digits in E.164"));

export const ContactRowSchema = z.object({
  phone: PhoneSchema,
  name: z.string().trim().max(120).optional(),
  // any extra CSV columns become template variables
  attributes: z.record(z.string()).default({}),
});
export type ContactRow = z.infer<typeof ContactRowSchema>;

/** Build a single display name from first/last parts. Returns undefined if both are blank. */
export function composeName(first?: string | null, last?: string | null): string | undefined {
  const name = [first, last].map((p) => p?.trim()).filter(Boolean).join(" ");
  return name.length > 0 ? name : undefined;
}

// Add a single contact via the UI. The phone is expected as E.164 digits (the
// form composes country code + national number); PhoneSchema re-validates it.
export const CreateContactSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().max(60).optional(),
  phone: PhoneSchema,
  listId: z.string().min(1).optional(),
  // extra key/value template variables
  attributes: z.record(z.string()).default({}),
});
export type CreateContactInput = z.infer<typeof CreateContactSchema>;

export const CreateBroadcastSchema = z.object({
  templateId: z.string().min(1),
  listId: z.string().min(1),
  // Map template {{1}},{{2}}... to a Contact field or literal.
  // e.g. [{ "from": "name" }, { "literal": "20% off" }]
  variableMap: z
    .array(
      z.union([
        z.object({ from: z.string().min(1) }),
        z.object({ literal: z.string() }),
      ]),
    )
    .default([]),
  // ISO 8601; null/absent = send now. Must be in the future if provided.
  scheduleAt: z
    .string()
    .datetime()
    .refine((s) => new Date(s).getTime() > Date.now(), "scheduleAt must be in the future")
    .optional(),
  // Media URL for the header — required when the chosen template has a media header.
  headerMediaUrl: z.string().url().optional(),
  // Coupon code — required when the chosen template has a COPY_CODE button.
  couponCode: z.string().trim().min(1).max(15).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export const CreateListSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

// Create a WhatsApp template and submit it to Meta for approval.
export const CreateTemplateSchema = z
  .object({
    name: z.string().trim().regex(/^[a-z0-9_]{1,512}$/, "Use lowercase letters, numbers, and underscores only"),
    language: z.string().trim().min(2).max(12),
    category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
    // Optional media header (attachment). PDF counts as DOCUMENT. The example is
    // a sample media URL/handle Meta uses while reviewing the template.
    header: z
      .object({
        format: z.enum(["IMAGE", "DOCUMENT", "VIDEO"]),
        example: z.string().trim().min(1, "Add a sample media URL for the header"),
      })
      .optional(),
    body: z.string().trim().min(1).max(1024),
    bodyExamples: z.array(z.string()).default([]),
    footer: z.string().trim().max(60).optional(),
    buttons: z
      .array(
        z.object({
          type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER", "COPY_CODE"]),
          text: z.string().trim().min(1).max(25),
          url: z.string().url().optional(),
          phoneNumber: z.string().trim().regex(/^\+?[0-9]{6,20}$/, "Use digits, optional leading +").optional(),
          couponExample: z.string().trim().min(1).max(15).optional(),
        }),
      )
      .max(3)
      .default([]),
    // Carousel: 2–10 cards, each a media URL + static body + optional URL button.
    carousel: z
      .object({
        cards: z
          .array(
            z.object({
              format: z.enum(["IMAGE", "VIDEO"]),
              mediaUrl: z.string().url(),
              body: z.string().trim().min(1).max(160),
              buttonText: z.string().trim().max(25).optional(),
              buttonUrl: z.string().url().optional(),
            }),
          )
          .min(2, "A carousel needs at least 2 cards")
          .max(10),
      })
      .optional(),
  })
  .refine((t) => t.buttons.every((b) => b.type !== "URL" || !!b.url), {
    message: "URL buttons need a URL",
    path: ["buttons"],
  })
  .refine((t) => t.buttons.every((b) => b.type !== "PHONE_NUMBER" || !!b.phoneNumber), {
    message: "Call buttons need a phone number",
    path: ["buttons"],
  })
  .refine((t) => t.buttons.every((b) => b.type !== "COPY_CODE" || !!b.couponExample), {
    message: "Copy-code buttons need a sample coupon code",
    path: ["buttons"],
  })
  .refine(
    (t) => {
      const vars = (t.body.match(/\{\{\d+\}\}/g) ?? []).length;
      return t.bodyExamples.filter((e) => e.trim()).length >= vars;
    },
    { message: "Provide an example value for each {{variable}}", path: ["bodyExamples"] },
  );

// 5-field cron (min hour dom month dow). Loose validation — BullMQ parses fully.
const CRON_RE = /^(\S+\s+){4}\S+$/;
export const CreateRecurringSchema = z.object({
  name: z.string().trim().min(1).max(120),
  templateId: z.string().min(1),
  listId: z.string().min(1),
  cron: z.string().trim().regex(CRON_RE, "cron must have 5 fields, e.g. 0 9 * * 1"),
  variableMap: z
    .array(z.union([z.object({ from: z.string().min(1) }), z.object({ literal: z.string() })]))
    .default([]),
});
export type CreateBroadcastInput = z.infer<typeof CreateBroadcastSchema>;

export const SendMessageSchema = z.object({
  text: z.string().trim().min(1, "Message can't be empty").max(4096),
});

export const CreateClientSchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(120),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,40}$/, "Slug: 2–40 lowercase letters, numbers, or hyphens").optional(),
  // Optional: provision the client's first ADMIN login alongside the tenant.
  // Blank password → the server auto-generates a strong one and returns it once.
  adminEmail: z.string().trim().email("Enter a valid admin email").optional(),
  adminPassword: z.string().min(8, "Password must be ≥8 chars").max(200).optional(),
});

// Inbound webhook payload — only the fields we consume, validated defensively.
export const WebhookSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string().optional(), // WABA id → owning client
      changes: z.array(
        z.object({
          field: z.string().optional(),
          value: z.object({
            // Identifies which business phone number (→ which client) this is for.
            metadata: z.object({ phone_number_id: z.string() }).optional(),
            // Template approval/rejection updates (field: message_template_status_update)
            event: z.string().optional(),
            message_template_name: z.string().optional(),
            message_template_language: z.string().optional(),
            reason: z.string().nullish(),
            statuses: z
              .array(
                z.object({
                  id: z.string(),
                  status: z.enum(["sent", "delivered", "read", "failed"]),
                  recipient_id: z.string().optional(),
                  errors: z.array(z.object({ title: z.string() })).optional(),
                }),
              )
              .optional(),
            messages: z
              .array(
                z.object({
                  from: z.string(),
                  id: z.string().optional(), // wamid of the inbound message
                  type: z.string(),
                  text: z.object({ body: z.string() }).optional(),
                  // Reply context: id = wamid of the message being replied to
                  // (i.e. the template we sent) — links a click back to a recipient.
                  context: z.object({ id: z.string() }).optional(),
                  // Quick-reply button tap on a template message.
                  button: z.object({ text: z.string().optional(), payload: z.string().optional() }).optional(),
                  // Interactive reply buttons / lists.
                  interactive: z
                    .object({
                      type: z.string().optional(),
                      button_reply: z.object({ id: z.string().optional(), title: z.string().optional() }).optional(),
                      list_reply: z.object({ id: z.string().optional(), title: z.string().optional() }).optional(),
                    })
                    .optional(),
                  // Inbound media (we store the id + type; download is a follow-up).
                  image: z.object({ id: z.string().optional(), mime_type: z.string().optional(), caption: z.string().optional() }).optional(),
                  document: z.object({ id: z.string().optional(), mime_type: z.string().optional(), filename: z.string().optional(), caption: z.string().optional() }).optional(),
                  audio: z.object({ id: z.string().optional(), mime_type: z.string().optional() }).optional(),
                  video: z.object({ id: z.string().optional(), mime_type: z.string().optional(), caption: z.string().optional() }).optional(),
                  sticker: z.object({ id: z.string().optional(), mime_type: z.string().optional() }).optional(),
                  reaction: z.object({ emoji: z.string().optional(), message_id: z.string().optional() }).optional(),
                  location: z.object({ latitude: z.number().optional(), longitude: z.number().optional(), name: z.string().optional(), address: z.string().optional() }).optional(),
                }),
              )
              .optional(),
          }),
        }),
      ),
    }),
  ),
});
export type WebhookPayload = z.infer<typeof WebhookSchema>;
