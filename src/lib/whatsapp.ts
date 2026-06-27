import { env } from "./env";

const BASE = `https://graph.facebook.com/${env.GRAPH_API_VERSION}`;

export interface TemplateComponent {
  type: "body";
  parameters: { type: "text"; text: string }[];
}

/**
 * Build the Cloud API template message payload.
 * Pure function — unit-tested without network access.
 */
export function buildTemplatePayload(args: {
  to: string;
  templateName: string;
  language: string;
  bodyParams: string[];
}) {
  const components: TemplateComponent[] =
    args.bodyParams.length > 0
      ? [
          {
            type: "body",
            parameters: args.bodyParams.map((text) => ({ type: "text", text })),
          },
        ]
      : [];

  return {
    messaging_product: "whatsapp",
    to: args.to,
    type: "template",
    template: {
      name: args.templateName,
      language: { code: args.language },
      ...(components.length ? { components } : {}),
    },
  } as const;
}

export class WhatsAppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "WhatsAppError";
  }
}

/** Returns the Meta message id (wamid) on success. Throws WhatsAppError otherwise. */
export async function sendTemplate(args: {
  to: string;
  templateName: string;
  language: string;
  bodyParams: string[];
}): Promise<string> {
  const res = await fetch(`${BASE}/${env.WA_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WA_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildTemplatePayload(args)),
  });

  const json = (await res.json().catch(() => ({}))) as {
    messages?: { id: string }[];
    error?: { message?: string; code?: number };
  };

  if (!res.ok) {
    // 429 (rate) and 5xx are transient → retryable. 4xx (bad number, paused template) → permanent.
    const retryable = res.status === 429 || res.status >= 500;
    throw new WhatsAppError(
      json.error?.message ?? `WA send failed (${res.status})`,
      res.status,
      retryable,
    );
  }

  const wamid = json.messages?.[0]?.id;
  if (!wamid) throw new WhatsAppError("No wamid in response", 500, true);
  return wamid;
}
