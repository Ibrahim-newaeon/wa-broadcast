# CLAUDE.md — Broadcast Console

Context for Claude Code working in this repo. Read this first.

## What this is
A self-hosted, **multi-tenant** **WhatsApp messaging platform** on Meta's **Cloud API**. Upload contacts → send approved template messages to lists → track delivery in real time → honor opt-outs → reply two-way in a live inbox. WATI/Infobip-style core. Brand: **NazzilVideo** (dark, teal→green, Inter/Cairo).

> Status: **built, deployed (Railway), and green** (typecheck · unit tests · build · e2e). Live Meta connection verified. This is **V1**. The Phase-2 roadmap + full feature spec live in **[`whatsapphub-V2.md`](./whatsapphub-V2.md)** (HTML at `public/whatsapphub-v2.html`, Arabic `…-ar.html`); V2 is being built as a separate fork (`../whatsapphub`). See also `HANDOFF.md` for the current status memo.

## Stack
Next.js 15 (App Router) · TypeScript strict (`noUncheckedIndexedAccess`) · Prisma + Postgres · BullMQ + Redis · jose + bcryptjs (auth) · Zod (validation) · Vitest (unit) · Playwright (e2e) · Docker Compose. Two processes from one image: **web** (Next) and **worker** (BullMQ consumer + recurring scheduler).

## Definition of done (the gate)
A change isn't done until **all three** pass:
1. `npm run typecheck`
2. `npm test`
3. `npm run build` (or `docker compose up --build` boots clean)
Do not mark work complete with failing types or tests.

## Commands
```
npm install && npm run prisma:generate   # generate Prisma client (required after schema changes)
npm run typecheck                         # tsc --noEmit  ← run this FIRST
npm test                                  # vitest unit (no DB/Redis needed)
npm run dev / npm run worker:dev          # local: web :3000 / worker (separate terminals)
npm run prisma:migrate -- --name <name>   # create+apply a migration
npm run seed:admin                        # seed first ADMIN from env
docker compose up --build                 # full stack (postgres+redis+app+worker), app runs migrate deploy
npm run test:e2e                          # Playwright (needs the app running)
./verify.sh                               # install → generate → typecheck → unit tests
```

## Project structure
```
wa-broadcast/
├─ ARCHITECTURE.md            # design + compliance (read for "why")
├─ README.md                  # setup + feature docs
├─ Dockerfile                 # multi-stage, non-root, healthcheck
├─ docker-compose.yml         # postgres · redis · app · worker
├─ next.config.mjs            # security headers, standalone output
├─ tsconfig.json              # strict + "@/*" path alias → src/*
├─ vitest.config.ts · playwright.config.ts
├─ verify.sh                  # offline verification (install→typecheck→unit)
├─ sample-contacts.csv        # demo upload
├─ prisma/
│  ├─ schema.prisma           # Contact, ContactList(+Membership), Template, Broadcast,
│  │                          #   BroadcastRecipient, MessageEvent, OptOut, User, RecurringCampaign
│  └─ migrations/             # 0001_init → 0004_recurring_campaign (hand-written SQL)
├─ scripts/
│  ├─ hash-password.mjs       # bcrypt hash for ADMIN_PASSWORD_HASH
│  └─ seed-admin.mjs          # upsert first ADMIN user
├─ theme/                     # design system docs (THEME.md, design-tokens.json, theme.css, palette.svg)
├─ public/tutorial.html       # standalone interactive tutorial (also served at /tutorial.html)
├─ load/webhook-load.js       # k6 HMAC-signed webhook load test
├─ e2e/                       # Playwright specs + DashboardPage POM
└─ src/
   ├─ middleware.ts           # EDGE: verifies access token only (no Redis here — see Gotchas)
   ├─ worker/index.ts         # send worker (rate-limited) + recurring scheduler + boot sync
   ├─ lib/
   │  ├─ env.ts               # Zod-validated process.env (fail-fast at boot)
   │  ├─ db.ts                # Prisma singleton
   │  ├─ queue.ts             # BullMQ send queue + ioredis connection
   │  ├─ recurring.ts         # BullMQ job-scheduler queue (cron) + upsert/remove
   │  ├─ whatsapp.ts          # Cloud API client + buildTemplatePayload (unit-tested)
   │  ├─ broadcast.ts         # createAndEnqueueBroadcast + resolveBodyParams (SHARED by API + worker)
   │  ├─ validation.ts        # all Zod schemas
   │  ├─ auth.ts              # jose sign/verify (EDGE-SAFE: no Redis/DB)
   │  ├─ tokenStore.ts        # Redis: refresh jti + version (NODE only)
   │  ├─ users.ts             # DB users + bcrypt + requireAdmin (NODE only)
   │  ├─ ratelimit.ts         # Redis fixed-window limiter
   │  ├─ apiFetch.ts          # client fetch wrapper w/ one-shot silent refresh
   │  └─ *.test.ts            # vitest: payload builder + phone validation
   ├─ app/
   │  ├─ layout.tsx · globals.css   # design system (single source of truth)
   │  ├─ page.tsx                   # dashboard (RSC)
   │  ├─ login/ contacts/ campaigns/ settings/   # pages
   │  ├─ broadcasts/[id]/page.tsx   # live detail
   │  └─ api/
   │     ├─ auth/{login,refresh,logout,logout-all}/
   │     ├─ broadcasts/  + [id]/  + [id]/retry/
   │     ├─ contacts/ (GET) + upload/ + [id]/ (PATCH/DELETE)
   │     ├─ lists/ · templates/ · users/ · recurring/ + [id]/
   │     ├─ webhooks/whatsapp/      # GET verify + POST (HMAC-verified)
   │     └─ health/
   └─ components/             # Nav, forms, LiveProgress, ContactsTable, CampaignsManager, UsersManager, LogoutButton
```

## Conventions
- **Imports:** use `@/...` everywhere EXCEPT `src/worker/index.ts`, which runs under `tsx` and uses relative `../lib/...` (tsx doesn't resolve tsconfig `paths`).
- **Validation:** every API body / CSV row / webhook payload goes through a Zod schema in `lib/validation.ts`.
- **DB:** Prisma only, no raw string SQL.
- **Auth split:** access token = short, stateless, edge-verified. Refresh = stateful (jti+version in Redis), rotated + revocation-checked only in `/api/auth/refresh` (Node). Roles ride in the access token.
- **Styling:** classes from `globals.css` (`.card .btn .badge--<STATUS>` etc.). Avoid new inline hex — use CSS vars.
- **Tests:** add positive AND negative cases. Unit-test pure logic (`lib/`), e2e for routes/pages.

## Gotchas / likely first-fix areas (nothing has compiled yet)
- **Prisma types:** after `prisma generate`, confirm imports like `RecipientStatus`, `Prisma.*WhereInput` resolve.
- **BullMQ version:** `recurring.ts` uses `upsertJobScheduler` / `removeJobScheduler` (v5 API). Verify against the installed `bullmq` version; older v5 used `upsertJobScheduler` differently or `addRepeatable`.
- **Migrations are hand-written.** If they drift from `schema.prisma`, prefer `prisma migrate dev` to regenerate, or reconcile.
- **`src/components/ui.ts`** is now unused (legacy) — safe to delete.
- **Middleware must stay edge-safe** — never import `tokenStore`, `users`, or Prisma into `middleware.ts`.
- **`strict` + `noUncheckedIndexedAccess`** will flag array indexing — expect a few small guards.

## Known limitations (by design / roadmap — not bugs to "fix" silently)
- Authorization is mostly authentication-only; only `/api/users` is role-gated. Per-action RBAC is a roadmap item.
- No actor attribution / audit log on broadcasts or deletions.
- Opt-in consent is trusted from the uploaded CSV, not structurally enforced.
- Contact delete is a no-op if the contact has broadcast history (FK `RESTRICT`).
- Access-token revocation lags ≤15 min by design; login rate-limit fails open.
- Per-worker rate limiting: running N workers can exceed your Meta tier (keep `WA_MPS × workers ≤ tier`).
