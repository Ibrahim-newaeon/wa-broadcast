# WhatsApp Hub — V2 Specification

_A self-hosted, multi-tenant messaging platform on Meta's Cloud API. This document is the single, fully-detailed reference for **everything the system does today (V1)** plus **everything planned for Phase 2 (V2)**._

> **Brand:** NazzilVideo (dark theme, teal→green, Inter/Cairo, bilingual EN/AR).
> **Positioning:** WATI / Infobip-style core — upload contacts → send approved template messages to lists → track delivery in real time → reply two-way → honor opt-outs — evolving from a **broadcast tool** into a **conversational engagement hub**.

- **Last updated:** 2026-06-29
- **Live deployment:** https://wa-broadcast-production-0392.up.railway.app (Railway: Postgres · Redis · `web` · `worker`)
- **Status:** V1 built, deployed, and green (typecheck · 49 unit tests · build · e2e). Live Meta connection verified.

---

## Table of contents
1. [Architecture & stack](#1-architecture--stack)
2. [Part I — V1: existing features (fully detailed)](#part-i--v1-existing-features)
3. [Part II — V2: Phase 2 features (fully detailed)](#part-ii--v2-phase-2-features)
4. [Data model — current + V2 additions](#data-model)
5. [Roadmap & sequencing](#roadmap--sequencing)
6. [Non-functional: security, compliance, deliverability](#non-functional-requirements)
7. [Known limitations & open items](#known-limitations--open-items)

---

## 1. Architecture & stack

| Layer | Technology |
|---|---|
| Web/app | Next.js 15 (App Router), React Server Components |
| Language | TypeScript strict (`noUncheckedIndexedAccess`) |
| Data | Prisma + PostgreSQL |
| Queue/jobs | BullMQ + Redis (send queue + recurring job-scheduler) |
| Auth | jose (JWT) + bcryptjs; access token edge-verified, refresh stateful in Redis |
| Validation | Zod (every API body / CSV row / webhook payload) |
| Tests | Vitest (unit), Playwright (e2e) |
| Deploy | Docker Compose / Railway — two processes from one image: **web** (Next) and **worker** (BullMQ consumer + recurring scheduler) |
| External | Meta WhatsApp Cloud API (Graph API) |

**Process model:** the `web` process serves the UI + API and enqueues sends; the `worker` process consumes the send queue (rate-limited per Meta tier), runs the recurring/drip scheduler, and performs boot-time sync.

**Key modules** (`src/lib/`): `env` (Zod-validated boot config), `db` (Prisma singleton), `queue` (BullMQ send queue), `recurring` (cron scheduler), `whatsapp` (Cloud API client + payload builders), `broadcast` (shared create+enqueue logic), `validation` (Zod schemas), `auth` (edge-safe JWT), `tokenStore` (Redis refresh jti+version), `users` (DB users + bcrypt + role guards), `ratelimit` (Redis fixed-window), `waConfig` (per-client effective Meta config), `tenancy` (pure multi-tenant resolution).

**Edge boundary:** `middleware.ts` verifies the access token only (no Redis/DB/Prisma at the edge). Refresh rotation + revocation happen only in the Node runtime (`/api/auth/refresh`).

---

# Part I — V1: existing features

Everything in this part is **built and live**.

## 1.1 Authentication & sessions
- **Email + password login** (`/login`, `POST /api/auth/login`); passwords bcrypt-hashed (cost 12).
- **Split-token model:** short-lived **access token** is stateless and edge-verified; the **refresh token** is stateful (jti + version stored in Redis), rotated on every refresh and revocation-checked only in `/api/auth/refresh`. Roles + client id ride in the access token claims (`role`, `cid`).
- **Logout** (`/api/auth/logout`) and **logout-all** (`/api/auth/logout-all`) — the latter bumps the token version to invalidate every active refresh token.
- **Bootstrap admin:** the env/seed admin (`scripts/seed-admin.mjs`, `npm run seed:admin`) creates the first SUPERADMIN; once any DB user exists, auth is fully DB-backed.
- **Login rate limiting** via a Redis fixed-window limiter (fails open by design).
- **Client fetch wrapper** (`apiFetch`) performs a one-shot silent token refresh on 401.

## 1.2 Multi-tenancy (Phase 3 — complete)
- **`Client` model** + a `clientId` on **every** entity. All data and routes are scoped per client.
- **Tenant resolution** (`lib/tenancy.ts`, pure + unit-tested): `getClientId(req)` / `getClientIdFromCookies()` return the **effective** client. A SUPERADMIN's **acting-client cookie (`acid`)** overrides their own `cid`; regular users are hard-pinned to their client.
- **Super-admin client switcher** (UI dropdown) + **Clients management** card (create / switch / delete).
- **Cascade client delete** — removes a tenant and all of its contacts, lists, templates, broadcasts, conversations, etc.
- **Per-client uniqueness:** phone is unique per `(clientId, phone)`; template per `(clientId, name, language)`.
- **Per-client WhatsApp config** — each tenant connects its own Meta number/credentials.
- **Per-client webhook signature verification** — inbound webhooks are routed to the owning client by WABA id (`entry.id`) and verified with **that client's** app secret.
- **Provision admin login on client create** _(added 2026-06-29)_ — when a SUPERADMIN creates a client they may supply an **admin email** (+ optional password; blank → a strong 16-char password is auto-generated). This creates the tenant's first **ADMIN** user and shows the credentials **once** so they can be handed off. The email is checked for uniqueness **before** the tenant is created (no orphaned clients).

## 1.3 Contacts
- **CSV import** (`/api/contacts/upload`) — every row validated through a Zod schema; phone numbers normalized; a **list snapshot is taken automatically before import** so it can be rolled back.
- **Single add** + **inline edit** (`PATCH /api/contacts/[id]`) + **bulk delete**.
- **Custom attributes** stored per contact (JSON) — usable as template variables.
- **Delete is FK-`RESTRICT`** if the contact has broadcast history (a no-op rather than orphaning analytics).
- **Sample CSV** (`sample-contacts.csv`) ships for demos.

## 1.4 Lists
- **Contact lists** with a **membership** join model.
- **List snapshots** — point-in-time backups of membership (`ContactListSnapshot`), taken manually or automatically before a CSV import, with **one-click restore**.
- **Unique list names per client** _(added 2026-06-29)_ — case-insensitive API check returns a friendly 409, backed by a DB unique index on `(clientId, name)` (migration `0015`, with a defensive dedupe so deploy never fails on pre-existing duplicates).

## 1.5 Templates
- **No-code template builder** (`/templates`) → submit to Meta for approval (`POST /api/templates`); local copy cached with Meta's returned status (usually `PENDING`).
- **Sync from Meta** (`GET /api/templates?sync=1`) — pulls all templates + statuses into the local cache; surfaces Meta's real error on failure _(hardened 2026-06-29)_.
- **Variables** — `{{1}}`, `{{2}}`… with required example values for approval.
- **Media-header templates (P0)** — IMAGE / DOCUMENT / VIDEO headers; the actual media is supplied per broadcast (`example.header_handle` via Meta's Resumable Upload API at create time).
- **Template-status webhook (P1)** — Meta approval/rejection auto-syncs the local status.
- **Rich templates (Phase 5, in progress):**
  - ✅ **Coupon copy-code** buttons (`COPY_CODE`) — code supplied per send.
  - ✅ **Carousel** — 2–10 static media cards (fixed body + button; only each card's media supplied on send; card defs stored on `Template.cards`).
  - ⏳ Remaining: limited-time-offer, authentication/OTP, catalog/products, Flows.

## 1.6 Broadcasts
- **Send now** or **schedule** for a future time.
- **Audience** = a list (with opt-outs automatically excluded).
- **Variable mapping** — body params resolved per recipient from contact fields/attributes (`resolveBodyParams`, shared by API + worker via `lib/broadcast.ts`).
- **Per-recipient tracking** (`BroadcastRecipient` + `MessageEvent`) with a live **delivery funnel** (queued → sent → delivered → read → failed) and **button-click event tracking**.
- **Retry failed** (`/api/broadcasts/[id]/retry`) — re-enqueues only the failed recipients.
- **Rate-limited sending** in the worker, honoring the Meta messages-per-second tier (`WA_MPS`).
- **Live detail page** (`/broadcasts/[id]`) with real-time progress (`LiveProgress`).

## 1.7 Recurring / drip campaigns (Phase 2 of V1)
- **`RecurringCampaign`** model + a **BullMQ job-scheduler** (cron, evaluated in **UTC**).
- Each tick creates a **fresh broadcast** from a template + list, honoring opt-outs.
- Managed at `/campaigns` (`CampaignsManager`): create, pause/resume, delete; presets (daily, weekdays, monthly) + raw 5-field cron.
- **Boot sync** reconciles scheduler state on worker start.

## 1.8 Two-way inbox (Phase 4 — complete)
- **`Conversation` / `Message`** models.
- **Inbound capture** for text, image, document, audio, video, sticker, interactive, reaction, location — **idempotent on `wamid`**.
- **24-hour service-window tracking** per conversation.
- **Outbound** free-form **text + attachments** (within the open window).
- **Media rendering** via a **token-safe proxy** (`/api/media/:id`) — Meta media requires the access token even on the temp URL, so the app proxies bytes (two-step: resolve temp URL → download).
- **Read receipts** (best-effort, never throws).
- **Live two-pane UI** (`/inbox`).

## 1.9 Opt-outs & compliance (V1 baseline)
- **STOP keyword** → writes an `OptOut` (unique per `(clientId, phone)`); opted-out contacts are excluded from all future broadcasts.
- **Opt-in consent** is trusted from the uploaded CSV (not yet structurally enforced — see V2 §2.11).

## 1.10 No-code WhatsApp setup
- **Settings → Connect WhatsApp** — per-client Phone number ID, **WhatsApp Business Account ID (WABA)**, App ID, access token, app secret, webhook verify token, Graph API version.
- **Test connection** — validates the credentials against Meta and shows the verified name + phone.
- **Webhook callback URL** + verify token shown for pasting into Meta; inbound webhooks HMAC-verified per client.
- Saved settings **override** env defaults with no redeploy.
- _(2026-06-29)_ Field labels clarified to prevent the common **WABA-id vs Business-Portfolio-id** mix-up.

## 1.11 Platform & ops
- **Health endpoint** (`/api/health`).
- **Security headers** + standalone output (`next.config.mjs`); multi-stage non-root Docker image with healthcheck.
- **Hand-written SQL migrations** `0001 → 0015`, applied on boot via `prisma migrate deploy`.
- **Offline verification** (`verify.sh`): install → generate → typecheck → unit tests.
- **k6 webhook load test** (`load/webhook-load.js`, HMAC-signed).
- **Standalone interactive tutorial** at `/tutorial.html` (bilingual).

---

# Part II — V2: Phase 2 features

Each feature below lists: **What**, **How it works**, **Data model**, **Dependencies**, **Effort** (S/M/L), and **Acceptance**. Effort assumes the existing stack.

## 2.1 ⭐ Omnichannel inbox (WhatsApp + Instagram DM + Messenger)
- **What:** extend the two-way inbox beyond WhatsApp to all Meta messaging surfaces — Instagram Direct, Messenger, and (optionally) IG/FB comment-to-DM — in **one unified agent view**.
- **How it works:**
  - Add a **`channel`** enum (`WHATSAPP | INSTAGRAM | MESSENGER`) to `Conversation` and `Message`.
  - Generalize the webhook handler: each channel posts to the same Graph webhook shape; route by `object` (`whatsapp_business_account` / `instagram` / `page`) and the per-client connected asset.
  - Generalize the send client: per-channel send endpoints share a thin adapter (`lib/channels/*`) over the existing `whatsapp.ts` patterns.
  - UI: channel filter + per-thread channel badge; the two-pane `/inbox` becomes channel-agnostic.
  - Per-client connection of IG/Page assets via the existing no-code settings pattern (or via Embedded Signup, §2.2).
- **Data model:** `Conversation.channel`, `Message.channel`, new `ChannelConnection` rows per client/asset.
- **Dependencies:** Meta IG Messaging + Messenger Platform permissions; webhook subscriptions per object.
- **Effort:** **L**.
- **Acceptance:** an inbound IG DM and a Messenger message appear in `/inbox` alongside WhatsApp, can be replied to, and respect each channel's messaging window.

## 2.2 ⭐ Meta Embedded Signup (one-click WhatsApp onboarding)
- **What:** replace manual entry of Phone number ID / WABA ID / token / app secret with Meta's **Embedded Signup** OAuth flow — a "Connect WhatsApp" button.
- **How it works:** launch Meta's Embedded Signup popup (Facebook JS SDK), receive the authorization code, exchange it server-side for a **long-lived system-user token**, and auto-discover the WABA id + phone number id via Graph. Persist to the per-client `WhatsAppConfig`.
- **Why:** **directly removes the #1 onboarding friction** (the WABA-vs-portfolio-id confusion and token-scope issues that required manual debugging). Enables true self-serve client onboarding.
- **Data model:** reuses `WhatsAppConfig`; add `wabaAutoConnected`, `tokenExpiresAt`.
- **Dependencies:** Meta Tech Provider / Solution Partner config; app review for `whatsapp_business_management` + `whatsapp_business_messaging`.
- **Effort:** **M**.
- **Acceptance:** a new client connects WhatsApp end-to-end without ever copy-pasting an ID or token.

## 2.3 ⭐ Team collaboration in the inbox
- **What:** turn the inbox into a real shared helpdesk.
- **How it works:**
  - **Conversation status:** `OPEN | PENDING | CLOSED`.
  - **Assignment** to an agent (+ "assigned to me" / unassigned filters).
  - **Internal notes** (agent-only, never sent) + **@mentions**.
  - **Canned replies / snippets** (per client), with variable substitution.
  - **SLA timers** (first-response / resolution) with breach indicators.
- **Data model:** `Conversation.status`, `Conversation.assigneeId`; new `InternalNote`, `CannedReply` models.
- **Dependencies:** existing users/roles.
- **Effort:** **M**.
- **Acceptance:** two agents can divide a queue without collisions; notes stay internal; canned replies insert in one click.

## 2.4 AI assist (Claude-powered)
- **What:** an AI layer over conversations and content.
- **Capabilities:** suggested replies; one-click **conversation summary**; **auto-translate** (AR↔EN, matching the bilingual brand); **intent + sentiment tagging**; **FAQ auto-answer** from a per-client knowledge base; draft-broadcast copy + template suggestions.
- **How it works:** server-side calls to the latest Claude model (e.g. `claude-opus-4-8` / `claude-sonnet-4-6`) via the Anthropic SDK; KB stored per client and retrieved (RAG) to ground answers; all AI actions are **agent-in-the-loop** (suggest, don't auto-send) by default, with an optional auto-responder mode (§2.5).
- **Data model:** `KnowledgeDoc`, `Message.aiTags`, `Conversation.aiSummary`.
- **Dependencies:** Anthropic API key per deployment; usage metering (§2.12).
- **Effort:** **M**.
- **Acceptance:** an agent gets a useful suggested reply and a one-paragraph thread summary; Arabic↔English translation works inline.

## 2.5 Automation, auto-replies & Flows
- **What:** 24/7 deflection and lead capture.
- **Capabilities:** business-hours + away messages; keyword auto-responders; a simple **no-code flow builder** (trigger → condition → action); **WhatsApp Flows** (native in-chat forms) for structured data capture; window-reopen via approved template.
- **How it works:** a rules engine evaluated in the worker on inbound events; Flows submitted to Meta like templates and rendered natively in WhatsApp.
- **Data model:** `AutomationRule`, `Flow` (definition + Meta id + status).
- **Dependencies:** WhatsApp Flows API.
- **Effort:** **L**.
- **Acceptance:** an off-hours message gets an away reply; a keyword triggers a flow that captures a name + email into the contact.

## 2.6 Contact 360 / CRM-lite
- **What:** a unified contact profile.
- **Capabilities:** full timeline (every conversation + broadcast across channels), tags, custom attributes editor, agent notes, opt-in/consent state, last-seen / window status.
- **Data model:** extends `Contact` (tags), reuses conversation/broadcast history; new `ContactNote`.
- **Effort:** **M**.
- **Acceptance:** opening a contact shows their entire cross-channel history on one page.

## 2.7 Dynamic segmentation, A/B testing & send-time controls
- **What:** smarter targeting than static lists.
- **Capabilities:** **dynamic segments** (auto-membership by attribute/behavior rules); **A/B test** broadcasts (split a list, compare delivery/read/click); **send-time** throttling and (later) per-contact timezone optimization.
- **Data model:** `Segment` (rule JSON, materialized membership), `Broadcast.variantOf`.
- **Effort:** **M**.
- **Acceptance:** a segment "opened in last 30 days" auto-updates; an A/B broadcast reports per-variant metrics.

## 2.8 Growth & lead capture
- **What:** top-of-funnel entry points.
- **Capabilities:** **wa.me** deep-link + **QR-code** generator (with prefilled message + tracking); embeddable **website chat widget**; **Click-to-WhatsApp ad** attribution (capture the `ctwa_clid`/referral on first inbound).
- **Data model:** `Contact.source`, `Conversation.referral`.
- **Effort:** **M**.
- **Acceptance:** scanning a QR opens WhatsApp pre-filled and the resulting contact is tagged with its source/campaign.

## 2.9 Analytics, link tracking & deliverability
- **What:** prove ROI and protect the number.
- **Capabilities:** per-recipient **link-click tracking** (URL shortener with redirect logging); conversion/ROI reporting; exportable reports (CSV/PDF); **number-quality + messaging-limit dashboard** (tier, quality rating, throughput) with **auto-pause on quality drop**; template performance leaderboard.
- **Data model:** `ShortLink`, `LinkClick`, `QualitySnapshot`.
- **Effort:** **M**.
- **Acceptance:** a broadcast shows click-through per recipient; a quality-rating drop triggers an alert/auto-pause.

## 2.10 Commerce
- **What:** transact inside chat.
- **Capabilities:** WhatsApp **catalog / product / multi-product messages**; order + shipping notifications; **abandoned-cart** flows; payment links where available.
- **Data model:** `Catalog`, `Product`, `Order`.
- **Dependencies:** Meta Commerce catalog; payment provider.
- **Effort:** **L**.
- **Acceptance:** a product message renders in WhatsApp and an order notification fires on purchase.

## 2.11 Governance: RBAC, audit log & consent
- **What:** close the V1 governance gaps.
- **Capabilities:** **per-action RBAC** (beyond today's authentication-only + `/api/users` role-gate); **audit log with actor attribution** on broadcasts, deletions, and config changes; **double opt-in** flows; **consent log** + GDPR data export/delete.
- **Data model:** `AuditEvent`, `ConsentRecord`, richer `Role`/`Permission`.
- **Effort:** **M**.
- **Acceptance:** every destructive/admin action is attributable; a contact can be exported and erased on request.

## 2.12 Billing & self-serve (SaaS track)
- **What:** monetize per tenant.
- **Capabilities:** **usage metering** (conversation-based, mirroring Meta's pricing) + plans/quotas; **Stripe billing**; in-app upgrade; usage dashboard per client. Pairs with Embedded Signup (§2.2) for fully self-serve onboarding.
- **Data model:** `Subscription`, `UsageRecord`, `Plan`.
- **Dependencies:** Stripe.
- **Effort:** **L**.
- **Acceptance:** a client signs up, connects WhatsApp, sends within quota, and is billed for overage.

## 2.13 Integrations & public API
- **What:** connect the hub to the rest of the stack.
- **Capabilities:** **outbound webhooks** (message/broadcast events); **Zapier/Make** app; a documented **public REST API** with per-client API keys; CRM/Sheets sync (HubSpot, Salesforce, Google Sheets).
- **Data model:** `ApiKey`, `OutboundWebhook`.
- **Effort:** **M**.
- **Acceptance:** an external system can create a contact and trigger a broadcast via API and receive delivery webhooks.

---

## Data model

### Existing (V1)
`Client` · `Contact` · `ContactList` (+ `ContactListMembership`, `ContactListSnapshot`) · `Template` · `Broadcast` · `BroadcastRecipient` · `MessageEvent` · `OptOut` · `User` · `RecurringCampaign` · `WhatsAppConfig` · `Conversation` · `Message`.

### V2 additions (by feature)
| Feature | New / changed models |
|---|---|
| Omnichannel inbox | `Conversation.channel`, `Message.channel`, `ChannelConnection` |
| Embedded Signup | `WhatsAppConfig.wabaAutoConnected`, `tokenExpiresAt` |
| Team collaboration | `Conversation.status/assigneeId`, `InternalNote`, `CannedReply` |
| AI assist | `KnowledgeDoc`, `Message.aiTags`, `Conversation.aiSummary` |
| Automation/Flows | `AutomationRule`, `Flow` |
| Contact 360 | `Contact.tags`, `ContactNote` |
| Segmentation/A-B | `Segment`, `Broadcast.variantOf` |
| Growth | `Contact.source`, `Conversation.referral` |
| Analytics/links | `ShortLink`, `LinkClick`, `QualitySnapshot` |
| Commerce | `Catalog`, `Product`, `Order` |
| Governance | `AuditEvent`, `ConsentRecord`, `Role`/`Permission` |
| Billing | `Subscription`, `UsageRecord`, `Plan` |
| Integrations | `ApiKey`, `OutboundWebhook` |

All new tables carry a `clientId` and follow the per-client scoping + cascade-delete conventions.

---

## Roadmap & sequencing

**Recommended order (each builds on the last):**
1. **Embedded Signup (§2.2)** — small, removes the top onboarding friction, unblocks self-serve.
2. **Omnichannel inbox (§2.1)** — the flagship Phase-2 capability.
3. **Team collaboration (§2.3)** — layered onto the unified inbox.
4. **AI assist (§2.4)** + **Automation/Flows (§2.5)** — compounding value once the inbox is omnichannel.
5. **Monetization track:** **Governance (§2.11)** + **Billing (§2.12)** for a SaaS, **or** **Commerce (§2.10)** for retail.

**Supporting features** (slot in opportunistically): Contact 360 (§2.6), Segmentation/A-B (§2.7), Growth (§2.8), Analytics/deliverability (§2.9), Integrations (§2.13).

| Phase 2 milestone | Features | Rough size |
|---|---|---|
| **M1 — Frictionless onboarding** | Embedded Signup | M |
| **M2 — Unified conversations** | Omnichannel inbox + Team collaboration | L + M |
| **M3 — Intelligence** | AI assist + Automation/Flows | M + L |
| **M4 — Targeting & proof** | Segmentation/A-B + Analytics/deliverability + Contact 360 | M each |
| **M5 — Monetize / transact** | Governance + Billing **or** Commerce | L |

---

## Non-functional requirements

- **Security:** keep `middleware.ts` edge-safe (no Redis/DB/Prisma); all new API bodies/webhooks validated with Zod; per-client webhook signature verification extended to every channel; secrets in per-client config, never committed.
- **Multi-tenancy:** every new entity carries `clientId`; queries always scoped through the tenant resolver; respect the SUPERADMIN acting-client override.
- **Deliverability:** per-worker rate limiting must keep `WA_MPS × workers ≤ Meta tier`; quality monitoring (§2.9) to avoid number throttling/bans.
- **Compliance:** double opt-in + consent logs (§2.11) before scaling outbound; honor opt-outs across **all** channels.
- **Definition of done (unchanged gate):** `npm run typecheck` · `npm test` · `npm run build` all green before any feature is considered complete. Add positive **and** negative tests for new logic; e2e for new routes/pages. Hand-written migrations continue from `0016`.
- **Observability:** health endpoint; structured logs on worker/webhook; (V2) per-client usage + audit dashboards.

---

## Known limitations & open items

Carried from V1 (each addressed by a V2 feature where noted):
- Authorization is mostly authentication-only; only `/api/users` is role-gated → **§2.11 RBAC**.
- No actor attribution / audit log on broadcasts or deletions → **§2.11 Audit**.
- Opt-in consent is trusted from the CSV, not structurally enforced → **§2.11 Consent / double opt-in**.
- Contact delete is a no-op when broadcast history exists (FK `RESTRICT`).
- Access-token revocation lags ≤15 min by design; login rate-limit fails open.
- Per-worker rate limiting: running N workers can exceed the Meta tier — keep `WA_MPS × workers ≤ tier`.
- **Live end-to-end** Meta verification: connection + template submit/sync verified; a full broadcast + inbox round-trip on a real number is the immediate next validation (see `VERIFY.md`).

_Phase 5 (rich templates) remaining from V1 also stands: limited-time-offer → authentication/OTP → catalog → Flows (catalog & Flows now folded into V2 §2.10 / §2.5)._
