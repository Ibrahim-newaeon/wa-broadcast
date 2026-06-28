import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getClientId } from "@/lib/users";
import { fetchMediaBytes } from "@/lib/whatsapp";

export const runtime = "nodejs";

/**
 * GET /api/media/:id — stream a message's media (scoped to the caller's client).
 * `id` is our Message id; we resolve the Meta media id and proxy the bytes so
 * the access token never reaches the browser.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const msg = await prisma.message.findFirst({
    where: { id, clientId: await getClientId(req) },
    select: { mediaId: true, mediaMime: true, mediaFilename: true, type: true, clientId: true },
  });
  if (!msg?.mediaId) return new NextResponse("not found", { status: 404 });

  const media = await fetchMediaBytes(msg.mediaId, msg.clientId);
  if (!media) return new NextResponse("media unavailable", { status: 502 });

  const mime = msg.mediaMime || media.mime;
  const disposition =
    msg.type === "document"
      ? `attachment; filename="${(msg.mediaFilename || "document").replace(/"/g, "")}"`
      : "inline";

  return new NextResponse(media.bytes, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Content-Disposition": disposition,
      // Message media is immutable — let the browser cache it.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
