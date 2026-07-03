# Handoff memo — WhatsApp Broadcast Platform

_Status snapshot for the next session. Last updated: 2026-07-03._

> **Resume protocol:** when the user says **"continue"**, pick up from **Next steps** below — no re-explaining, no re-planning.

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
- **Lead capture (2026-07-02):** public bilingual lead form on the landing page (`#get-started`) → `POST /api/leads` (no auth, 5/10min per-IP rate limit, honeypot) → Contact upserted into an auto-created **"Website Leads"** list under the default client + `lead.created` audit row. Operator follow-up = template broadcast to that list (the only Meta-legal way to message a lead who never wrote in).
- **Public legal pages (2026-07-02, PR #8):** `/privacy-policy` · `/terms-and-conditions` · `/data-deletion` — public via middleware allowlist (Meta App Review links to them), shared `LegalShell` frame, footer links from the landing.
- **Branding unified: "Broadcast Hub" (2026-07-02, PR #9):** the landing had borrowed V2's name (whatsapphub) while the app said broadcastconsole. Everything is now **Broadcast Hub** (nav/login wordmarks, metadata, footer AR «مركز البث», legal pages, tutorial, theme docs). **"WhatsApp Hub" is V2-only.** Also fixed stale e2e dashboard selectors (heading "Dashboard" at `/dashboard`).
- **App retheme to landing palette (2026-07-02, PR #10):** root tokens in `globals.css` remapped to the landing's WhatsApp-green (`.dk`) palette — surfaces `#06140d`/`#0c1f16`, accent `#25d366`, landing gradient on buttons/progress, wordmark green+ink, Schibsted Grotesk h1/h2, light theme remapped too. Delivery-status colors intentionally unchanged. Theme docs synced. **Verified live on Railway** (CSS bundle carries the new palette).
- **Polish round (2026-07-03):** ① **Per-card carousel media** — broadcasts can override each carousel card's media URL per send (blank = template default); overrides saved on `Broadcast.cardMediaUrls` so retries reuse them (pure logic in `lib/carousel.ts`, unit-tested; migration `0018`). ② **Richer inbox** — conversation search (`?q=` on name/phone digits/preview) + **send-template-from-inbox** (`POST /api/conversations/:id/template`, 📋 in the composer) to re-open closed 24h windows; rich templates (media/coupon/carousel/LTO) are rejected with a pointer to broadcasts. ③ **Media-retention fallback** — `/api/media/:id` now returns **410** when Meta has aged the media out (~30 days) vs 502 for transient failures; inbox bubbles swap in a quiet "media no longer available" placeholder instead of a broken player.
- **Broadcast message preview (2026-07-03):** the broadcast form renders a live WhatsApp-style preview (header/LTO/body/footer/buttons/carousel cards) with `{{n}}` variables substituted as you type (`field:x` shows as a ⟨x⟩ token). Backed by `Template.bodyText/footerText/buttons` mirrored from Meta on **create + sync** (migration `0019`; pre-existing cached templates show the preview after their next sync). Pure logic in `lib/templatePreview.ts` (tested).
- **Docs** — README, bilingual tutorial (`/tutorial.html`), VERIFY.md, this memo.

## Migrations
`0001`→`0019`. Recent: `0014` carousel · `0015` list-name unique · `0016` limited-time offer · `0017` audit log · `0018` broadcast card-media overrides · `0019` template body mirror (preview). Hand-written SQL; applied on boot.

## Next steps (priority order)
1. **🔴 Finish live end-to-end verification — [VERIFY.md](./VERIFY.md).** The live Meta **connection** is verified (real number on the Default client — see the meta-credentials memory), but the full round-trip (broadcast sends: plain → media → coupon → carousel, plus the inbox round-trip) isn't recorded as done. _The user drives the Meta-side steps; assistant tails the worker + webhook logs and fixes real payload bugs._ **Do this before building more.**
2. **🟠 Phase 5 remaining** (by fit): authentication/OTP (transactional, low broadcast fit) → catalog/products (needs a Meta Commerce catalog) → Flows (big, niche).
3. ~~🟡 Polish ideas~~ — **done 2026-07-03** (carousel card media overrides, inbox search + template-from-inbox, media-retention fallback). Not yet deployed/merged — see the session's branch/commit state.

## Key technical notes for next session
- **Multi-tenancy:** `getClientId(req)` / `getClientIdFromCookies()` resolve the effective client; a SUPERADMIN's `acid` cookie overrides their own `cid` (regular users are hard-pinned). Pure logic in `src/lib/tenancy.ts` (tested).
- **Webhooks:** verified against the owning client's app secret (resolved by `entry.id` WABA id); per-change writes routed by `metadata.phone_number_id` else the entry's WABA client.
- **Carousel:** cards are **static** (fixed body + button); only the media is supplied on send; card defs stored on `Template.cards` and reused per broadcast.
- **Builds without secrets:** `SKIP_ENV_VALIDATION=1 npm run build`.
- **Gates (must stay green):** `npm run typecheck` · `npm test` (77) · `npm run build`. E2E: `BASE_URL=… E2E_EMAIL=… E2E_PASSWORD=… npx playwright test tenant-isolation` (skips without creds; self-cleans its test clients).
- **Imports:** `@/…` everywhere except `src/worker/index.ts` (relative, runs under tsx).

## Security to-dos
- **Revoke the Railway account token** used this session when finished (it was used for CLI/log access).
- WhatsApp creds belong in Settings → Connect WhatsApp (per client), not committed. `.env` stays gitignored; repo is private.
