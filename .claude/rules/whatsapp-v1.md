---
paths:
  - "src/**"
  - "prisma/**"
  - "scripts/**"
---

# Broadcast Hub V1 rules

- This is the V1 repository. Do not copy V2 paths or assumptions from `whatsapphub`.
- Preserve explicit consent, opt-out enforcement, approved template use, signature verification, idempotency, bounded retries, rate limits, and audit records.
- Derive account and tenant scope from authenticated server context.
- Never log message bodies, access tokens, webhook secrets, or full phone numbers.
- Production sends, backfills, migrations, and deployment require explicit approval.
