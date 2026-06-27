// Vitest global setup — runs before any test module is evaluated.
// `src/lib/env.ts` validates process.env at import time (fail-fast by design),
// so unit tests that transitively import it (e.g. whatsapp.ts) need the required
// vars present. These are dummy values: unit tests touch no DB/Redis/network.
// Real values (if exported in the shell) take precedence — we only fill gaps.
const TEST_ENV: Record<string, string> = {
  WA_PHONE_NUMBER_ID: "test-phone-id",
  WA_BUSINESS_ACCOUNT_ID: "test-waba-id",
  WA_ACCESS_TOKEN: "test-access-token",
  META_APP_SECRET: "test-app-secret",
  WA_WEBHOOK_VERIFY_TOKEN: "test-verify-token",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/test",
  REDIS_URL: "redis://localhost:6379",
  AUTH_JWT_SECRET: "test-jwt-secret-at-least-32-characters-long",
  ADMIN_EMAIL: "admin@example.com",
  ADMIN_PASSWORD_HASH: "$2a$10$testtesttesttesttesttesttesttesttesttesttesttest",
  NODE_ENV: "test",
};

for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] ??= value;
}
