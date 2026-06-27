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
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

export const CreateListSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

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

// Inbound webhook payload — only the fields we consume, validated defensively.
export const WebhookSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          value: z.object({
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
                  type: z.string(),
                  text: z.object({ body: z.string() }).optional(),
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
