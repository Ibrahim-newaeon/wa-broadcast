import { prisma } from "./db";

// The inbound-message shape we consume from the webhook (subset of Meta's payload).
export interface InboundMessage {
  from: string;
  id?: string;
  type: string;
  text?: { body: string };
  image?: { id?: string; mime_type?: string; caption?: string };
  document?: { id?: string; mime_type?: string; filename?: string; caption?: string };
  audio?: { id?: string; mime_type?: string };
  video?: { id?: string; mime_type?: string; caption?: string };
  sticker?: { id?: string; mime_type?: string };
  reaction?: { emoji?: string; message_id?: string };
  interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
  button?: { text?: string };
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
}

const TYPE_PREVIEW: Record<string, string> = {
  image: "📷 Photo", document: "📄 Document", audio: "🎙️ Voice message",
  video: "🎬 Video", sticker: "🌟 Sticker", location: "📍 Location", reaction: "Reaction",
};

/** Normalize an inbound message into our stored shape. */
function normalize(m: InboundMessage) {
  if (m.text?.body) return { type: "text", text: m.text.body, mediaId: null, mediaMime: null, mediaFilename: null };
  if (m.image) return { type: "image", text: m.image.caption ?? null, mediaId: m.image.id ?? null, mediaMime: m.image.mime_type ?? null, mediaFilename: null };
  if (m.document) return { type: "document", text: m.document.caption ?? null, mediaId: m.document.id ?? null, mediaMime: m.document.mime_type ?? null, mediaFilename: m.document.filename ?? null };
  if (m.audio) return { type: "audio", text: null, mediaId: m.audio.id ?? null, mediaMime: m.audio.mime_type ?? null, mediaFilename: null };
  if (m.video) return { type: "video", text: m.video.caption ?? null, mediaId: m.video.id ?? null, mediaMime: m.video.mime_type ?? null, mediaFilename: null };
  if (m.sticker) return { type: "sticker", text: null, mediaId: m.sticker.id ?? null, mediaMime: m.sticker.mime_type ?? null, mediaFilename: null };
  if (m.reaction) return { type: "reaction", text: m.reaction.emoji ?? null, mediaId: null, mediaMime: null, mediaFilename: null };
  if (m.interactive) return { type: "interactive", text: m.interactive.button_reply?.title ?? m.interactive.list_reply?.title ?? null, mediaId: null, mediaMime: null, mediaFilename: null };
  if (m.button) return { type: "interactive", text: m.button.text ?? null, mediaId: null, mediaMime: null, mediaFilename: null };
  if (m.location) return { type: "location", text: m.location.name ?? m.location.address ?? null, mediaId: null, mediaMime: null, mediaFilename: null };
  return { type: m.type || "text", text: null, mediaId: null, mediaMime: null, mediaFilename: null };
}

/**
 * Record an inbound customer message into its conversation thread (per client).
 * Idempotent on the message wamid — Meta retries webhooks, and a retry must not
 * double-count unread or duplicate the message.
 */
export async function recordInboundMessage(clientId: string, m: InboundMessage): Promise<void> {
  if (m.id) {
    const existing = await prisma.message.findUnique({ where: { wamid: m.id }, select: { id: true } });
    if (existing) return;
  }

  const n = normalize(m);
  const preview = (n.text && n.text.trim()) || TYPE_PREVIEW[n.type] || "New message";
  const contact = await prisma.contact.findFirst({ where: { clientId, phone: m.from }, select: { id: true } });
  const now = new Date();

  const convo = await prisma.conversation.upsert({
    where: { clientId_phone: { clientId, phone: m.from } },
    create: {
      clientId, phone: m.from, contactId: contact?.id ?? null,
      lastInboundAt: now, lastMessageAt: now, lastPreview: preview, unread: 1,
    },
    update: {
      lastInboundAt: now, lastMessageAt: now, lastPreview: preview,
      unread: { increment: 1 },
      ...(contact ? { contactId: contact.id } : {}),
    },
  });

  await prisma.message.create({
    data: {
      clientId, conversationId: convo.id, direction: "IN",
      type: n.type, text: n.text, mediaId: n.mediaId, mediaMime: n.mediaMime,
      mediaFilename: n.mediaFilename, wamid: m.id ?? null,
    },
  });
}
