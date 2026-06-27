import { prisma } from "./db";
import { env } from "./env";

// Effective WhatsApp Cloud API connection config. Values saved through the
// no-code setup page (WhatsAppConfig row) take precedence; env vars are the
// fallback so the app still works before anything is configured.
export interface WaConfig {
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  appSecret: string;
  webhookVerifyToken: string;
  graphApiVersion: string;
}

const CONFIG_ID = "default";

export async function getWaConfig(): Promise<WaConfig> {
  const row = await prisma.whatsAppConfig.findUnique({ where: { id: CONFIG_ID } }).catch(() => null);
  return {
    phoneNumberId: row?.phoneNumberId || env.WA_PHONE_NUMBER_ID,
    businessAccountId: row?.businessAccountId || env.WA_BUSINESS_ACCOUNT_ID,
    accessToken: row?.accessToken || env.WA_ACCESS_TOKEN,
    appSecret: row?.appSecret || env.META_APP_SECRET,
    webhookVerifyToken: row?.webhookVerifyToken || env.WA_WEBHOOK_VERIFY_TOKEN,
    graphApiVersion: row?.graphApiVersion || env.GRAPH_API_VERSION,
  };
}

/** Save (upsert) connection settings. Undefined/empty fields are left unchanged. */
export async function saveWaConfig(patch: Partial<Record<keyof WaConfig, string | undefined>>): Promise<void> {
  // Only persist provided non-empty values (so secrets aren't wiped by blanks).
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (typeof v === "string" && v.trim()) data[k] = v.trim();
  }
  await prisma.whatsAppConfig.upsert({
    where: { id: CONFIG_ID },
    create: { id: CONFIG_ID, ...data },
    update: data,
  });
}

/** What the no-code UI shows: non-secret values + whether each secret is set. */
export async function getWaConfigStatus(): Promise<{
  phoneNumberId: string;
  businessAccountId: string;
  webhookVerifyToken: string;
  graphApiVersion: string;
  hasAccessToken: boolean;
  hasAppSecret: boolean;
  savedAt: string | null;
}> {
  const row = await prisma.whatsAppConfig.findUnique({ where: { id: CONFIG_ID } }).catch(() => null);
  const cfg = await getWaConfig();
  return {
    phoneNumberId: row?.phoneNumberId ?? "",
    businessAccountId: row?.businessAccountId ?? "",
    webhookVerifyToken: row?.webhookVerifyToken ?? "",
    graphApiVersion: row?.graphApiVersion || env.GRAPH_API_VERSION,
    hasAccessToken: Boolean(cfg.accessToken),
    hasAppSecret: Boolean(cfg.appSecret),
    savedAt: row?.updatedAt.toISOString() ?? null,
  };
}
