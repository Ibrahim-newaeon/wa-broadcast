# WA Broadcast

A single-business WhatsApp broadcast system on Meta's **Cloud API**. Upload contacts → pick an approved template → send → track delivery & opt-outs. WATI/Infobip-style core, self-hosted.

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the full design and compliance notes.

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

## Connect the webhook
In Meta App Dashboard → WhatsApp → Configuration:
- **Callback URL:** `https://YOUR_DOMAIN/api/webhooks/whatsapp`
- **Verify token:** value of `WA_WEBHOOK_VERIFY_TOKEN`
- Subscribe to **messages** events.
Locally, tunnel with `ngrok http 3000` and use the https URL.

## Usage flow
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
Single admin from env (no user table). Password is a bcrypt hash; JWTs signed with `AUTH_JWT_SECRET` (HS256). Login is rate-limited (`LOGIN_RATE_MAX`/`LOGIN_RATE_WINDOW`, Redis-backed).

**Token split (standard, secure):**
- **Access token** — 15 min, stateless, verified by edge `middleware.ts`. Revocation isn't instant for access tokens (≤15 min window) — the normal JWT tradeoff.
- **Refresh token** — 7 days, carries a `jti` (rotation id) + `ver` (user token-version). `/api/auth/refresh` (Node) is the revocation gate: it **rotates** the jti on every use and **detects reuse** (a replayed/stolen old token → whole session family revoked).
- **Logout (this device)** — `POST /api/auth/logout` revokes the current jti.
- **Logout everywhere** — `POST /api/auth/logout-all` bumps `ver`, killing every refresh token; access dies within ≤15 min.

Seamless nav: when access expires, `/login` silently calls `/api/auth/refresh` on mount and forwards — the form only appears if the session was actually revoked.

## Pages
- **/** — dashboard: stats, list/upload/broadcast forms, recent broadcasts.
- **/broadcasts/[id]** — live progress, status filters, pagination, retry-failed.
- **/contacts** — search, opt out / re-subscribe, delete.
- **/campaigns** — recurring/drip campaigns (cron, UTC) with pause/resume.
- **/settings** — team members (ADMIN-only invite).

## Theme / design system
Brand: **NazzilVideo** (dark, teal→green, Inter/Cairo). Live stylesheet: `src/app/globals.css`; tokens/docs in `theme/`. Status colors map to `.badge--<STATUS>`.

## Multi-user
DB-backed users (`User` table, migration `0003`). First login bootstraps the env admin when the table is empty; seed explicitly with `npm run seed:admin`. Roles: ADMIN (manage users) / MEMBER. Access tokens carry the role.

## Recurring campaigns
`RecurringCampaign` (migration `0004`) + a BullMQ job-scheduler queue (`wa-recurring`). The worker re-syncs active schedules on boot and, on each cron tick, creates a fresh broadcast via the shared `createAndEnqueueBroadcast` helper. Schedules run in **UTC**.

## Interactive tutorial
Standalone, self-contained `public/tutorial.html` — open directly or at `/tutorial.html`. Stepper, tabs, copy buttons, and a localStorage-persisted checklist.

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
