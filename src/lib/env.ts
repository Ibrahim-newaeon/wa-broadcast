import { z } from "zod";

// Validate process.env once at boot. Fail fast on misconfiguration.
const EnvSchema = z.object({
  GRAPH_API_VERSION: z.string().default("v21.0"),
  WA_PHONE_NUMBER_ID: z.string().min(1),
  WA_BUSINESS_ACCOUNT_ID: z.string().min(1),
  WA_ACCESS_TOKEN: z.string().min(1),
  META_APP_SECRET: z.string().min(1),
  WA_WEBHOOK_VERIFY_TOKEN: z.string().min(1),
  WA_MPS: z.coerce.number().int().positive().default(80),
  OPT_OUT_KEYWORDS: z.string().default("STOP,UNSUBSCRIBE"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // ─── Auth ───────────────────────────────────────────────────────
  AUTH_JWT_SECRET: z.string().min(32, "AUTH_JWT_SECRET must be ≥32 chars"),
  ADMIN_EMAIL: z.string().email(),
  ADMIN_PASSWORD_HASH: z.string().min(1), // bcrypt hash; see scripts/hash-password.mjs
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL: z.string().default("7d"),
  LOGIN_RATE_MAX: z.coerce.number().int().positive().default(5), // attempts
  LOGIN_RATE_WINDOW: z.coerce.number().int().positive().default(300), // seconds
});

// Strict at boot, but skippable at build time (e.g. `next build` in a Docker
// image / Railway, before runtime secrets exist). Set SKIP_ENV_VALIDATION=1.
export const env = process.env.SKIP_ENV_VALIDATION
  ? (process.env as unknown as z.infer<typeof EnvSchema>)
  : EnvSchema.parse(process.env);

export const optOutKeywords = (env.OPT_OUT_KEYWORDS || "STOP,UNSUBSCRIBE")
  .split(",")
  .map((k) => k.trim().toUpperCase())
  .filter(Boolean);
