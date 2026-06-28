import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/users";
import { uploadMedia, sendMedia, WhatsAppError } from "@/lib/whatsapp";

export const runtime = "nodejs";

const MAX_BYTES = 90 * 1024 * 1024; // Meta's hard cap is 100MB; stay under.

/** Map a file's MIME to the WhatsApp message media type. */
function mediaType(mime: string): "image" | "video" | "audio" | "document" {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

/** POST /api/conversations/:id/media — send a file (image/doc/audio/video) reply. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const clientId = await getClientId(req);
  const { id } = await ctx.params;

  const convo = await prisma.conversation.findFirst({ where: { id, clientId }, select: { id: true, phone: true } });
  if (!convo) return NextResponse.json({ error: "not found" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const caption = (form?.get("caption") as string | null)?.trim() || undefined;
  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large" }, { status: 400 });

  const type = mediaType(file.type || "application/octet-stream");
  const filename = file.name || "file";

  let wamid: string;
  let mediaId: string;
  try {
    mediaId = await uploadMedia(await file.arrayBuffer(), file.type || "application/octet-stream", filename, clientId);
    wamid = await sendMedia({ to: convo.phone, type, mediaId, caption, filename, clientId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "send failed";
    const code = e instanceof WhatsAppError ? e.status : 502;
    return NextResponse.json({ error: message }, { status: code });
  }

  const created = await prisma.message.create({
    data: {
      clientId, conversationId: id, direction: "OUT", type,
      text: caption ?? null, mediaId, mediaMime: file.type || null,
      mediaFilename: type === "document" ? filename : null, wamid, status: "SENT",
    },
  });
  await prisma.conversation.update({
    where: { id },
    data: { lastMessageAt: created.createdAt, lastPreview: caption || `📎 ${filename}`, unread: 0 },
  });

  return NextResponse.json({
    message: {
      id: created.id, direction: "OUT", type, text: created.text,
      mediaMime: created.mediaMime, mediaFilename: created.mediaFilename, status: "SENT", createdAt: created.createdAt,
    },
  }, { status: 201 });
}
