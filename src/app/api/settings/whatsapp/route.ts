import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWaConfigStatus, saveWaConfig } from "@/lib/waConfig";
import { getClientId, requireAdmin } from "@/lib/users";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

/** GET /api/settings/whatsapp — current connection settings (secrets masked). */
export async function GET(req: NextRequest) {
  return NextResponse.json(await getWaConfigStatus(await getClientId(req)));
}

const SaveSchema = z.object({
  phoneNumberId: z.string().trim().max(64).optional(),
  businessAccountId: z.string().trim().max(64).optional(),
  appId: z.string().trim().max(64).optional(),
  accessToken: z.string().trim().max(1024).optional(),
  appSecret: z.string().trim().max(256).optional(),
  webhookVerifyToken: z.string().trim().max(256).optional(),
  graphApiVersion: z.string().trim().regex(/^v\d+\.\d+$/, "Use a version like v21.0").optional(),
});

/** PUT /api/settings/whatsapp — save settings (ADMIN only; blank secrets are kept). */
export async function PUT(req: NextRequest) {
  if (!(await requireAdmin(req))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = SaveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const clientId = await getClientId(req);
  await saveWaConfig(parsed.data, clientId);
  // Log which fields changed — never the values (they include secrets).
  void audit(req, "settings.whatsapp_updated", null, {
    fields: Object.entries(parsed.data).filter(([, v]) => v !== undefined && v !== "").map(([k]) => k),
  });
  return NextResponse.json({ ok: true, ...(await getWaConfigStatus(clientId)) });
}
