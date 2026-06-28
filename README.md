# WA Broadcast

A self-hosted, **multi-tenant** WhatsApp messaging platform on Meta's **Cloud API**. Upload contacts → pick an approved template → broadcast → track delivery & opt-outs → reply two-way in a live inbox. WATI/Infobip-style core.

Highlights: **multi-client tenancy** (each client = its own contacts, templates, number, team — see [Multi-tenancy](#multi-tenancy)), a **two-way inbox** ([Inbox](#two-way-inbox)), **rich templates** (media headers, coupon copy-code, carousels — see [Templates](#templates)), scheduling + recurring campaigns, and per-broadcast analytics.

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the full design and compliance notes, and **[VERIFY.md](./VERIFY.md)** for the end-to-end live-verification checklist.

## Stack
Next.js (App Router) · TypeScript strict · Prisma + Postgres · BullMQ + Redis · Docker Compose. Web and worker run as separate processes from one image.

## Prerequisites
1. A Meta **WhatsApp Business Account (WABA)** + a phone number.
2. At least one **approved message template**.
3. A **permanent access token** (System User token), the **App Secret**, and your **Phone Number ID** + **WABA ID**.

## Quick start (Docker)
```bash
cp .env.example .env                          # fill in WA_* and META_APP_SECRET
node scripts/hash-password.mjs 'YourPassword' # paste output → ADMIN_PASSWORD_HASH
#   also set ADMIN_EMAIL and a long AUTH_JWT_SECRET (≥32 chars)
docker compose up --build                     # postgres, redis, app (runs migrations), worker
```
First load redirects to **/login**. Sign in with `ADMIN_EMAIL` + your password.
App: http://localhost:3000 · Health: http://localhost:3000/api/health

> First run: `app` runs `prisma migrate deploy`. To create the initial migration locally before first deploy: `npm run prisma:migrate --name init`.

## Local dev (no Docker)
```bash
npm install
npm run prisma:migrate -- --name init
npm run dev          # web on :3000
npm run worker:dev   # worker (separate terminal)
```

## Connect WhatsApp + webhook
Easiest: **Settings → Connect WhatsApp** — paste the Phone number ID, Business account ID, **App ID** (needed for template media uploads), access token, and app secret (DB values override env), then **Test connection**. The page also shows the callback URL to copy.

In Meta App Dashboard → WhatsApp → Configuration:
- **Callback URL:** `https://YOUR_DOMAIN/api/webhooks/whatsapp`
- **Verify token:** your webhook verify token
- Subscribe to **messages** events (delivery/read receipts + inbound button taps).
Locally, tunnel with `ngrok http 3000` and use the https URL. Every webhook is HMAC-verified against the app secret.

## Usage flow
0. **Create a template (optional):** on **/templates**, build one with an optional media header (image/PDF/video — the sample is uploaded to Meta via the resumable-upload API), body variables, footer, and quick-reply / URL / call buttons, then submit to Meta for approval. Endpoints: `POST /api/templates` and `POST /api/templates/media` (returns a header handle).
1. **Sync templates:** `GET /api/templates?sync=1` (pulls approved templates from Meta).
2. **Upload contacts:** `POST /api/contacts/upload` (multipart: `file`, optional `listId`). See `sample-contacts.csv`.
3. **Create broadcast:** `POST /api/broadcasts`
   ```json
   {
     "templateId": "<id>",
     "listId": "<id>",
     "variableMap": [{ "from": "name" }, { "literal": "20%" }]
   }
   ```
   `variableMap` fills the template's `{{1}}, {{2}}, …` in order — `{from:"name"}` or `{from:"<csv column>"}` pulls per-contact; `{literal:"…"}` is a constant.
   Add `"scheduleAt": "2026-07-01T09:00:00Z"` (ISO 8601, future) to **schedule** instead of sending now — jobs are enqueued with a BullMQ delay and the broadcast shows as `SCHEDULED` until it fires.
4. Watch progress on the dashboard. Inbound **STOP** auto-opts-out and excludes from future sends.

All UI and `/api/*` routes (except `/api/auth/*`, `/api/webhooks/*`, `/api/health`) require a valid admin session, enforced in `middleware.ts`. Tokens are httpOnly cookies (15-min access + 7-day refresh via `/api/auth/refresh`).

## Auth model
DB-backed users with a bootstrap env admin (used only when the Users table is empty; that admin is a **SUPERADMIN**). Passwords are bcrypt hashes; JWTs signed with `AUTH_JWT_SECRET` (HS256). The access token carries the user's `role` and `clientId` (`cid`); a super-admin's acting client is overridden by the `acid` cookie. Login is rate-limited (`LOGIN_RATE_MAX`/`LOGIN_RATE_WINDOW`, Redis-backed).

**Token split (standard, secure):**
- **Access token** — 15 min, stateless, verified by edge `middleware.ts`. Revocation isn't instant for access tokens (≤15 min window) — the normal JWT tradeoff.
- **Refresh token** — 7 days, carries a `jti` (rotation id) + `ver` (user token-version). `/api/auth/refresh` (Node) is the revocation gate: it **rotates** the jti on every use and **detects reuse** (a replayed/stolen old token → whole session family revoked).
- **Logout (this device)** — `POST /api/auth/logout` revokes the current jti.
- **Logout everywhere** — `POST /api/auth/logout-all` bumps `ver`, killing every refresh token; access dies within ≤15 min.

Seamless nav: when access expires, `/login` silently calls `/api/auth/refresh` on mount and forwards — the form only appears if the session was actually revoked.

## Pages
- **/** — bilingual (EN/AR) marketing landing with light/dark toggle → log in.
- **/dashboard** — stats, list/upload/broadcast forms, recent broadcasts.
- **/inbox** — **two-way conversations** (see [Inbox](#two-way-inbox)).
- **/broadcasts/[id]** — live progress + **analytics funnel** (Sent → Delivered → Read → Clicked, with rates) and **button-event tracking** (taps per button), status filters, pagination, retry-failed.
- **/contacts** — import (CSV, with a downloadable template) or **add one** (name + country code), **inline edit**, **multi-select bulk delete**, opt out / re-subscribe. Lists keep **snapshot backups** with one-click **restore**.
- **/templates** — **create templates** (see [Templates](#templates)) and submit to Meta; sync approved ones.
- **/campaigns** — recurring/drip campaigns (cron, UTC) with pause/resume.
- **/settings** — **Connect WhatsApp** (no-code Meta credentials + App ID + webhook URL + test connection), team members (ADMIN-only invite), and — for super-admins — **Clients** management.

## Multi-tenancy
Every record is scoped to a **Client** (tenant); a bootstrap `default` client owns pre-existing data. Roles: **SUPERADMIN** (manages clients) / **ADMIN** (manages a client's team) / **MEMBER**. A super-admin sees a **client switcher** in the nav and a **Clients** panel in Settings to create clients, switch into them (an `acid` cookie overrides their tenant), and delete them (cascades all data). Each client has its **own** WhatsApp connection (number, token, App ID), and inbound webhooks route to the owning client by **WABA id** and are verified against **that client's** app secret. Regular users are hard-pinned to their client. Enforced by `e2e/tenant-isolation.spec.ts`.

## Two-way inbox
`/inbox` is a live two-pane conversation view. Inbound messages (text, image, document, audio/voice, video, sticker, interactive replies, reactions, location) are threaded per client (idempotent on `wamid`); the **24-hour service window** is tracked from the last inbound message. Reply with **text** or **attachments** (📎) within the window; media is streamed through a token-safe proxy (`/api/media/:id`); opening a thread sends a WhatsApp **read receipt**. Delivery status (sent→delivered→read) is mirrored onto your sent messages.

## Templates
Create on **/templates** and submit to Meta for approval:
- **Media header** — image / PDF·document / video (the sample is uploaded to Meta's resumable-upload API for a handle).
- **Body** with `{{variables}}` + optional **footer**.
- **Buttons** (up to 3): quick-reply / URL / **call** (phone) / **copy-code** (coupon).
- **Carousel** — 2–10 media cards, each with a media URL, text, and an optional URL button (cards are static; the top-level body is personalized).

Broadcasting a media-header template asks for the media URL; a coupon template asks for the code; a carousel reuses its stored card media automatically. Endpoints: `POST /api/templates`, `POST /api/templates/media` (header handle). Sync approved templates with `GET /api/templates?sync=1`.

## Theme / design system
Brand: **NazzilVideo** (dark, teal→green, Inter/Cairo). Live stylesheet: `src/app/globals.css`; tokens/docs in `theme/`. Status colors map to `.badge--<STATUS>`.

## Multi-user
DB-backed users (`User` table, migration `0003`). First login bootstraps the env admin (as SUPERADMIN) when the table is empty; seed explicitly with `npm run seed:admin`. Roles: **SUPERADMIN** (manage clients), **ADMIN** (manage a client's team), **MEMBER**. Users belong to a client; ADMINs invite teammates into their (acting) client. See [Multi-tenancy](#multi-tenancy).

## Recurring campaigns
`RecurringCampaign` (migration `0004`) + a BullMQ job-scheduler queue (`wa-recurring`). The worker re-syncs active schedules on boot and, on each cron tick, creates a fresh broadcast via the shared `createAndEnqueueBroadcast` helper. Schedules run in **UTC**.

## Deploy (Railway)
See **RAILWAY.md**. The 4 pieces are Postgres, Redis, a **web** service, and a **worker** (web + worker run from the same image with different start commands). Gotcha: Railway runs the start command **without a shell**, so chained commands must be wrapped — `sh -c "npx prisma migrate deploy && npm run start"`. The app reads Railway's injected `$PORT`.

## Interactive tutorial
Standalone, self-contained `public/tutorial.html` — open directly or at `/tutorial.html`. Stepper, tabs, copy buttons, theme toggle, and a localStorage-persisted checklist. (English only for now.)

## Retry failed recipients
Open a broadcast → if any recipients are `FAILED`, a **Retry N failed** button re-queues just those (recomputed from the saved `variableMap`, opt-outs still excluded). New BullMQ job ids avoid dedupe against the original sends.

## Tests
```bash
npm run typecheck    # tsc strict
npm test             # vitest: payload builder + phone validation (positive + negative)
npm run test:e2e     # playwright POM smoke (dashboard, health, 400/401 paths)
```

### API load testing (k6)
Webhook ingest is the load-sensitive surface. The script signs each body with HMAC so it passes verification:
```bash
k6 run -e BASE_URL=http://localhost:3000 -e APP_SECRET=$META_APP_SECRET load/webhook-load.js
# ramps to 200 VUs; thresholds: p95 < 300ms, error rate < 1%.
```

## Scaling
- Raise `WA_MPS` **only after** Meta upgrades your throughput tier (default 80 → up to 1,000 msg/s).
- Scale by running multiple `worker` containers — BullMQ distributes jobs and the limiter is per-worker, so keep total `WA_MPS × workers ≤ your tier`.

## Serverless alternative
Run `app` on Vercel; move Postgres → Neon/Supabase, Redis → Upstash. The **worker must stay on an always-on host** (Railway/Fly/VM) — it cannot be serverless.
