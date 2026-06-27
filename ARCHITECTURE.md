# WhatsApp Broadcast System — Architecture & Compliance

**Scope:** Single-business broadcast tool. Upload contacts → pick an approved template → send a broadcast over Meta's WhatsApp Cloud API → track delivery/read/reply + opt-outs.
**Reference products:** WATI, Infobip (feature parity target for v1: contact lists, template broadcasts, delivery tracking, opt-out handling).

---

## 1. Grounded facts (verified, June 2026)

| Fact | Value | Why it matters |
|---|---|---|
| Sending API | WhatsApp **Cloud API** (Meta-hosted, Graph API) | No on-prem container to run; webhooks for status |
| Graph API version | Set via `GRAPH_API_VERSION` env (e.g. `v21.0`) | Meta ships ~quarterly; never hardcode |
| Pricing model | **Per-message** since **July 1, 2025** (marketing / utility / authentication categories) | Cost = approved-template category × region, per delivered message |
| Default throughput | **80 messages/sec**, auto-upgradable to **1,000 mps** | Worker must rate-limit to avoid 429s |
| Business-initiated cap | **Messaging tier**: 1K → 10K → 100K → unlimited unique recipients / rolling 24h | Broadcast size is gated by your current tier |
| Templates | Must be **pre-approved** by Meta before sending | You can only broadcast approved template names |
| 24-hour window | Free-form (non-template) replies allowed only within 24h of the user's last message | Broadcasts are template-only by definition |

> Confidence: HIGH on model/throughput/templates. The exact Graph version and per-message rates change — both are config/region-dependent, not hardcoded. Verify rates against Meta's pricing page for your region before go-live.

Sources: see end of this doc.

---

## 2. High-level architecture

```
                ┌──────────────┐      CSV upload / UI
   Admin  ────► │  Next.js app │ ◄───────────────────────
                │ (App Router) │
                └──────┬───────┘
          enqueue jobs │            ┌────────────┐
                       ▼            │  Postgres  │  contacts, templates,
                ┌────────────┐ ◄───►│  (Prisma)  │  broadcasts, events, opt-outs
                │   Redis    │      └────────────┘
                │  (BullMQ)  │
                └──────┬─────┘
       rate-limited    │
       worker pulls    ▼
                ┌────────────┐   POST /messages   ┌──────────────────┐
                │  Worker    │ ─────────────────► │ Meta Cloud API   │
                │ (Node)     │ ◄───────────────── │ (Graph)          │
                └────────────┘   webhook status   └──────────────────┘
                       ▲
                       │ status/inbound/opt-out
                ┌──────┴───────┐
                │ /api/webhooks│  (signature-verified)
                └──────────────┘
```

Three processes: **web** (Next.js), **worker** (BullMQ consumer), shared **Postgres** + **Redis**. The worker is a separate container so sends keep flowing independent of web traffic — this is the main reason for Docker/self-host over serverless.

---

## 3. Data model (see `prisma/schema.prisma`)

- **Contact** — phone (E.164), name, attributes (JSON for template vars), `optedOut` flag.
- **ContactList** + **ContactListMembership** — many-to-many segmentation.
- **Template** — cached copy of Meta-approved templates (name, language, category, variable count).
- **Broadcast** — a send job: template + target list + status (`DRAFT|QUEUED|SENDING|COMPLETED|FAILED`).
- **BroadcastRecipient** — per-contact row: `wamid`, status (`PENDING|SENT|DELIVERED|READ|FAILED`), error.
- **MessageEvent** — append-only webhook log (status callbacks, inbound messages).
- **OptOut** — phone + timestamp + source. Enforced at enqueue time.

---

## 4. WhatsApp send flow

1. Admin creates a **Broadcast** (template + list). API validates with Zod, checks every recipient against `OptOut` and `Contact.optedOut`.
2. One **BullMQ job per recipient** enqueued (idempotency key = `broadcastId:contactId`).
3. **Worker** consumes with a rate limiter (`limiter: { max: WA_MPS, duration: 1000 }`), builds the template payload, POSTs to `/{phoneNumberId}/messages`, stores returned `wamid`.
4. Meta sends async **webhook** status updates → `/api/webhooks/whatsapp` → update `BroadcastRecipient` + append `MessageEvent`.
5. **Inbound** "STOP"/"UNSUBSCRIBE" (configurable keywords) → create `OptOut`, set `Contact.optedOut=true`.

Retry: BullMQ exponential backoff (3 attempts) on transient errors (429, 5xx). Permanent errors (invalid number, template paused) fail fast and are recorded.

---

## 5. Compliance guardrails (non-negotiable)

- **Opt-in required.** Only message contacts who opted in. Store opt-in source/date on `Contact.attributes`.
- **Opt-out honored automatically.** STOP keyword → `OptOut` → excluded from all future broadcasts. Surface an opt-out count per broadcast.
- **Template-only broadcasts.** No free-form business-initiated messages (would be rejected / policy violation).
- **PII handling.** Contact phone numbers + names are PII. Stored in your Postgres only; tokens in env/secret store, never in code. Encrypt DB volume at rest in production.
- **Rate + tier respect.** Worker throttles to `WA_MPS`; broadcast pre-check warns if recipient count exceeds your messaging tier's 24h cap.
- **Webhook authenticity.** Verify `X-Hub-Signature-256` (HMAC-SHA256 with `META_APP_SECRET`) on every webhook before trusting it.

---

## 6. Security baseline

- Zod validation on **every** input (CSV rows, API bodies, webhook payloads).
- Rate limiting on public endpoints (webhook, auth) via middleware.
- Helmet-equivalent security headers (set in `next.config` / middleware).
- Parameterized DB access only (Prisma — no raw string SQL).
- Non-root Docker user, healthcheck endpoints, multi-stage build.
- Secrets via env / Docker secrets; `.env` git-ignored; `.env.example` documents keys.

---

## 7. Tech stack & rationale

| Layer | Choice | Why |
|---|---|---|
| App | Next.js (App Router) + TypeScript strict | RSC by default, single codebase UI+API |
| Validation | Zod | One schema, reused for forms/API/webhook |
| DB | Postgres + Prisma | Relational fit (lists, recipients, events); typed client |
| Queue | BullMQ + Redis | Built-in rate limiter + retries + concurrency |
| Worker | Node process (same image, different entrypoint) | Long-running sends; survives web restarts |
| Deploy | Docker Compose (app + worker + postgres + redis) | Persistent worker, PII on your infra, matches stack |

**Serverless swap point:** to run web on Vercel instead, move Postgres→Neon/Supabase, Redis→Upstash, and run the worker on a small always-on box (Railway/Fly/VM). The worker cannot be serverless.

---

## 8. Out of scope for v1 (roadmap)

Multi-tenant accounts & per-tenant WABA onboarding · template builder/submission UI · two-way inbox/chat · campaign analytics dashboards · A/B testing · scheduled/drip campaigns · media-message templates · CSV column mapping UI. The schema is designed so multi-tenancy can be added later (add `tenantId` FK to top-level tables).

---

## Sources
- [Pricing on the WhatsApp Business Platform — Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)
- [WhatsApp API Pricing Update: Effective July 1, 2025 — YCloud](https://www.ycloud.com/blog/whatsapp-api-pricing-update)
- [Scale WhatsApp Cloud API: Throughput Limits & Upgrades (2026) — wuseller](https://www.wuseller.com/whatsapp-business-knowledge-hub/scale-whatsapp-cloud-api-master-throughput-limits-upgrades-2026/)
- [WhatsApp Cloud API Integration in 2026 — Medium](https://medium.com/@aktyagihp/whatsapp-cloud-api-integration-in-2026-0493dd05d644)
