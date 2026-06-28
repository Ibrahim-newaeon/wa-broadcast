import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getWaConfigStatus, saveWaConfig } from "@/lib/waConfig";

export const runtime = "nodejs";

/** GET /api/settings/whatsapp — current connection settings (secrets masked). */
export async function GET() {
  return NextResponse.json(await getWaConfigStatus());
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

/** PUT /api/settings/whatsapp — save settings (blank secrets are kept). */
export async function PUT(req: NextRequest) {
  const parsed = SaveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  await saveWaConfig(parsed.data);
  return NextResponse.json({ ok: true, ...(await getWaConfigStatus()) });
}
