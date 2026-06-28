import { NextRequest, NextResponse } from "next/server";
import { getWaConfig } from "@/lib/waConfig";
import { getClientId } from "@/lib/users";

export const runtime = "nodejs";

/**
 * POST /api/settings/whatsapp/test — verify the saved credentials by asking
 * Meta for the phone number's details. Always 200; `ok` indicates success.
 */
export async function POST(req: NextRequest) {
  const cfg = await getWaConfig(await getClientId(req));
  if (!cfg.phoneNumberId || !cfg.accessToken) {
    return NextResponse.json({ ok: false, error: "Phone number ID and access token are required." });
  }

  try {
    const url = `https://graph.facebook.com/${cfg.graphApiVersion}/${cfg.phoneNumberId}?fields=verified_name,display_phone_number,quality_rating`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${cfg.accessToken}` } });
    const json = (await res.json().catch(() => ({}))) as {
      verified_name?: string;
      display_phone_number?: string;
      quality_rating?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: json.error?.message ?? `Meta returned ${res.status}` });
    }
    return NextResponse.json({
      ok: true,
      name: json.verified_name ?? null,
      phone: json.display_phone_number ?? null,
      quality: json.quality_rating ?? null,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Connection failed" });
  }
}
