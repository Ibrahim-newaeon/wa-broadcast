# Handoff memo — WhatsApp Broadcast Platform

_Status snapshot for the next session. Last updated: 2026-06-28._

## TL;DR
A self-hosted, **multi-tenant** WhatsApp messaging platform on Meta's Cloud API is **built, deployed, and green** (typecheck · 45 unit tests · build · 1 e2e). It does broadcasts, a two-way inbox, and rich templates across isolated clients.

**The one thing not yet done:** nothing has been sent through a **real** Meta WhatsApp account. Everything is verified against Meta's *documented* payload shapes (unit tests + endpoint smoke tests) — not against a live WABA. **Next session's top priority is the live end-to-end verification in [VERIFY.md](./VERIFY.md).**

## Live deployment
- **URL:** https://wa-broadcast-production-0392.up.railway.app
- **Stack on Railway:** Postgres · Redis · `web` (Next) · `worker` (BullMQ + scheduler), all from one image.
- **Deploy:** `git push origin main` → Railway auto-builds & runs `prisma migrate deploy` on boot.
- **Gotcha:** Railway runs the start command **without a shell** — chained commands must be wrapped: `sh -c "npx prisma migrate deploy && npm run start"`. App reads Railway's injected `$PORT`.
- **Admin:** the env/seed admin is a **SUPERADMIN** (bootstrap client `default`).

## What's built (all live)
- **Core broadcasting** — templates, contacts (CSV import + single add + bulk delete + list snapshots/restore), lists, broadcasts (send-now + schedule), recurring/drip campaigns (cron, UTC), per-broadcast analytics funnel + button-event tracking, opt-outs (STOP), retry-failed.
- **No-code WhatsApp setup** — Settings → Connect WhatsApp (per-client Meta creds + App ID + test connection); webhook HMAC-verified.
- **P0** — media-header templates are broadcastable (header media sent per broadcast).
- **P1** — template-status webhook auto-syncs Meta approval/rejection.
- **Phase 3 — multi-tenancy (COMPLETE):** `Client` model + `clientId` on every entity; auth token carries `cid`; all data + routes scoped per client; per-client uniques (`phone`, `name+language`); per-client WhatsApp config; super-admin **client switcher** (`acid` cookie) + Clients management + **cascade client-delete**; **per-client webhook signatures** (routed by WABA id `entry.id`). Enforced by `e2e/tenant-isolation.spec.ts`.
- **Phase 4 — two-way inbox (COMPLETE):** `Conversation`/`Message` models; inbound capture for text/image/document/audio/video/sticker/interactive/reaction/location (idempotent on `wamid`); 24h-window tracking; outbound **text + attachments**; **media rendering** via token-safe proxy (`/api/media/:id`); **read receipts**; live two-pane `/inbox`.
- **Phase 5 — rich templates (IN PROGRESS):** ✅ coupon **copy-code** buttons · ✅ **carousel** (2–10 static media cards) · ✅ **limited-time offer** (banner text ≤16 chars on the template; optional countdown whose expiry is supplied per broadcast, migration `0016`). ⏳ remaining below.
- **RBAC + audit trail (2026-07-02):** MEMBER role is now enforced — admin-only routes (template submit, contact deletes, snapshot restore, recurring CRUD, WhatsApp settings) return 403 via `requireAdmin`; role-aware UI hides those controls (`useRole` → `/api/auth/me`). Every consequential mutation writes an `AuditLog` row (`lib/audit.ts`, best-effort, never blocks); admins browse it in Settings → Activity (`/api/audit`). Migration `0017`.
- **Docs** — README, bilingual tutorial (`/tutorial.html`), VERIFY.md, this memo.

## Migrations
`0001`→`0017`. Recent: `0011` bootstrap superadmin · `0012` two-way messaging · `0013` copy-code · `0014` carousel · `0015` list-name unique · `0016` limited-time offer · `0017` audit log. Hand-written SQL; applied on boot.

## Next steps (priority order)
1. **🔴 Live end-to-end verification — [VERIFY.md](./VERIFY.md).** Connect a real number (Settings → Connect WhatsApp), send a broadcast (plain → media → coupon → carousel), and do the inbox round-trip. _The user drives the Meta-side steps; assistant tails the worker + webhook logs and fixes real payload bugs._ This will likely shake out 1–2 small payload issues that unit tests can't catch. **Do this before building more.**
2. **🟠 Phase 5 remaining** (by fit): authentication/OTP (transactional, low broadcast fit) → catalog/products (needs a Meta Commerce catalog) → Flows (big, niche).
3. **🟡 Polish ideas:** per-card carousel variables; richer inbox (search, templates-from-inbox to reopen closed windows); media-retention fallback for old outbound media.

## Key technical notes for next session
- **Multi-tenancy:** `getClientId(req)` / `getClientIdFromCookies()` resolve the effective client; a SUPERADMIN's `acid` cookie overrides their own `cid` (regular users are hard-pinned). Pure logic in `src/lib/tenancy.ts` (tested).
- **Webhooks:** verified against the owning client's app secret (resolved by `entry.id` WABA id); per-change writes routed by `metadata.phone_number_id` else the entry's WABA client.
- **Carousel:** cards are **static** (fixed body + button); only the media is supplied on send; card defs stored on `Template.cards` and reused per broadcast.
- **Builds without secrets:** `SKIP_ENV_VALIDATION=1 npm run build`.
- **Gates (must stay green):** `npm run typecheck` · `npm test` (45) · `npm run build`. E2E: `BASE_URL=… E2E_EMAIL=… E2E_PASSWORD=… npx playwright test tenant-isolation` (skips without creds; self-cleans its test clients).
- **Imports:** `@/…` everywhere except `src/worker/index.ts` (relative, runs under tsx).

## Security to-dos
- **Revoke the Railway account token** used this session when finished (it was used for CLI/log access).
- WhatsApp creds belong in Settings → Connect WhatsApp (per client), not committed. `.env` stays gitignored; repo is private.
