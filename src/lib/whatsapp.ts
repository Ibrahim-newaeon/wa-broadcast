import { getWaConfig } from "./waConfig";

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
  // When the template has a media header, the actual media is supplied per-send.
  headerFormat?: string | null; // IMAGE | DOCUMENT | VIDEO
  headerMediaUrl?: string | null;
}) {
  const components: Record<string, unknown>[] = [];

  // Media header component (image/document/video) — Meta requires the media on send.
  if (args.headerFormat && args.headerMediaUrl) {
    const kind = args.headerFormat.toLowerCase(); // image | document | video
    components.push({
      type: "header",
      parameters: [{ type: kind, [kind]: { link: args.headerMediaUrl } }],
    });
  }

  if (args.bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: args.bodyParams.map((text) => ({ type: "text", text })),
    });
  }

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
  headerFormat?: string | null;
  headerMediaUrl?: string | null;
  clientId?: string;
}): Promise<string> {
  const cfg = await getWaConfig(args.clientId);
  const res = await fetch(`https://graph.facebook.com/${cfg.graphApiVersion}/${cfg.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
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

// ── Template creation (submit for Meta approval) ─────────────────────
export interface TemplateButtonInput {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phoneNumber?: string;
}
export interface TemplateHeaderInput { format: "IMAGE" | "DOCUMENT" | "VIDEO"; example: string }
export interface CreateTemplateInput {
  name: string;
  language: string;
  category: string;
  header?: TemplateHeaderInput;
  body: string;
  bodyExamples: string[];
  footer?: string;
  buttons: TemplateButtonInput[];
}

/** Count {{n}} placeholders in a template body. */
export function countTemplateVars(body: string): number {
  return (body.match(/\{\{\d+\}\}/g) ?? []).length;
}

/**
 * Build the `components` array for the Cloud API message_templates payload.
 * Pure function — unit-tested without network access.
 */
export function buildTemplateComponents(input: CreateTemplateInput): Record<string, unknown>[] {
  const components: Record<string, unknown>[] = [];

  // Media header (attachment). Meta wants a sample under example.header_handle.
  if (input.header) {
    components.push({
      type: "HEADER",
      format: input.header.format,
      example: { header_handle: [input.header.example] },
    });
  }

  const body: Record<string, unknown> = { type: "BODY", text: input.body };
  const varCount = countTemplateVars(input.body);
  if (varCount > 0) {
    // Meta wants one example row covering every {{n}}.
    body.example = { body_text: [input.bodyExamples.slice(0, varCount)] };
  }
  components.push(body);

  if (input.footer) components.push({ type: "FOOTER", text: input.footer });

  if (input.buttons.length > 0) {
    components.push({
      type: "BUTTONS",
      buttons: input.buttons.map((b) => {
        if (b.type === "URL") return { type: "URL", text: b.text, url: b.url };
        if (b.type === "PHONE_NUMBER") return { type: "PHONE_NUMBER", text: b.text, phone_number: b.phoneNumber };
        return { type: "QUICK_REPLY", text: b.text };
      }),
    });
  }
  return components;
}

/**
 * Upload a sample file to Meta's Resumable Upload API and return a media handle
 * for use as a template header sample (example.header_handle). Two steps:
 * create an upload session, then upload the bytes from offset 0.
 */
export async function uploadTemplateMedia(
  bytes: ArrayBuffer,
  fileName: string,
  mimeType: string,
  clientId?: string,
): Promise<string> {
  const cfg = await getWaConfig(clientId);
  if (!cfg.appId) {
    throw new WhatsAppError("Set the Meta App ID in Settings → Connect WhatsApp to upload media.", 400, false);
  }
  const base = `https://graph.facebook.com/${cfg.graphApiVersion}`;
  // 1) create an upload session
  const q = new URLSearchParams({ file_name: fileName, file_length: String(bytes.byteLength), file_type: mimeType });
  const sessRes = await fetch(`${base}/${cfg.appId}/uploads?${q.toString()}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${cfg.accessToken}` },
  });
  const sess = (await sessRes.json().catch(() => ({}))) as { id?: string; error?: { message?: string } };
  if (!sessRes.ok || !sess.id) {
    throw new WhatsAppError(sess.error?.message ?? `upload session failed (${sessRes.status})`, sessRes.status, false);
  }
  // 2) upload the bytes (single shot from offset 0) — returns the handle in `h`
  const upRes = await fetch(`${base}/${sess.id}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${cfg.accessToken}`, file_offset: "0" },
    body: new Blob([bytes]),
  });
  const up = (await upRes.json().catch(() => ({}))) as { h?: string; error?: { message?: string } };
  if (!upRes.ok || !up.h) {
    throw new WhatsAppError(up.error?.message ?? `media upload failed (${upRes.status})`, upRes.status, false);
  }
  return up.h;
}

/** Submit a template to Meta for approval. Returns the new template id + status. */
export async function createTemplate(input: CreateTemplateInput, clientId?: string): Promise<{ id?: string; status?: string }> {
  const cfg = await getWaConfig(clientId);
  const res = await fetch(`https://graph.facebook.com/${cfg.graphApiVersion}/${cfg.businessAccountId}/message_templates`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name,
      language: input.language,
      category: input.category,
      components: buildTemplateComponents(input),
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    status?: string;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new WhatsAppError(json.error?.message ?? `template create failed (${res.status})`, res.status, false);
  }
  return { id: json.id, status: json.status };
}
