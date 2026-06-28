import { prisma } from "./db";
import { env } from "./env";
import { DEFAULT_CLIENT_ID } from "./tenancy";

// Effective WhatsApp Cloud API connection config. Values saved through the
// no-code setup page (WhatsAppConfig row) take precedence; env vars are the
// fallback so the app still works before anything is configured.
export interface WaConfig {
  phoneNumberId: string;
  businessAccountId: string;
  appId: string;
  accessToken: string;
  appSecret: string;
  webhookVerifyToken: string;
  graphApiVersion: string;
}

// Bootstrap tenant that owns all pre-existing data until multi-client onboarding.
export { DEFAULT_CLIENT_ID };

/** Map an inbound webhook's phone_number_id to the client that owns it. */
export async function getClientIdByPhoneNumberId(phoneNumberId: string): Promise<string | null> {
  const row = await prisma.whatsAppConfig
    .findFirst({ where: { phoneNumberId }, select: { clientId: true } })
    .catch(() => null);
  return row?.clientId ?? null;
}

export async function getWaConfig(clientId: string = DEFAULT_CLIENT_ID): Promise<WaConfig> {
  const row = await prisma.whatsAppConfig.findUnique({ where: { clientId } }).catch(() => null);
  return {
    phoneNumberId: row?.phoneNumberId || env.WA_PHONE_NUMBER_ID,
    businessAccountId: row?.businessAccountId || env.WA_BUSINESS_ACCOUNT_ID,
    appId: row?.appId || env.WA_APP_ID,
    accessToken: row?.accessToken || env.WA_ACCESS_TOKEN,
    appSecret: row?.appSecret || env.META_APP_SECRET,
    webhookVerifyToken: row?.webhookVerifyToken || env.WA_WEBHOOK_VERIFY_TOKEN,
    graphApiVersion: row?.graphApiVersion || env.GRAPH_API_VERSION,
  };
}

/** Save (upsert) connection settings. Undefined/empty fields are left unchanged. */
export async function saveWaConfig(
  patch: Partial<Record<keyof WaConfig, string | undefined>>,
  clientId: string = DEFAULT_CLIENT_ID,
): Promise<void> {
  // Only persist provided non-empty values (so secrets aren't wiped by blanks).
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (typeof v === "string" && v.trim()) data[k] = v.trim();
  }
  await prisma.whatsAppConfig.upsert({
    where: { clientId },
    create: { clientId, ...data },
    update: data,
  });
}

/** What the no-code UI shows: non-secret values + whether each secret is set. */
export async function getWaConfigStatus(clientId: string = DEFAULT_CLIENT_ID): Promise<{
  phoneNumberId: string;
  businessAccountId: string;
  appId: string;
  webhookVerifyToken: string;
  graphApiVersion: string;
  hasAccessToken: boolean;
  hasAppSecret: boolean;
  savedAt: string | null;
}> {
  const row = await prisma.whatsAppConfig.findUnique({ where: { clientId } }).catch(() => null);
  const cfg = await getWaConfig(clientId);
  return {
    phoneNumberId: row?.phoneNumberId ?? "",
    businessAccountId: row?.businessAccountId ?? "",
    appId: row?.appId ?? "",
    webhookVerifyToken: row?.webhookVerifyToken ?? "",
    graphApiVersion: row?.graphApiVersion || env.GRAPH_API_VERSION,
    hasAccessToken: Boolean(cfg.accessToken),
    hasAppSecret: Boolean(cfg.appSecret),
    savedAt: row?.updatedAt.toISOString() ?? null,
  };
}
