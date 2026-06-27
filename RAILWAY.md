# Deploy to Railway

This app needs **4 pieces**: Postgres, Redis, a **web** service, and a **worker**
service. Web + worker run from this same repo/Docker image with different start
commands.

## 1. Create the project
1. Railway → **New Project → Deploy from GitHub repo** → pick this repo.
   Railway detects the `Dockerfile` and uses `railway.json` (runs
   `prisma migrate deploy` then `npm run start`, health-checks `/api/health`).
2. Add **Database → Add PostgreSQL** and **Database → Add Redis** to the project.

## 2. Web service variables
On the web service → **Variables**, set:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference the Postgres plugin) |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` |
| `WA_PHONE_NUMBER_ID`, `WA_BUSINESS_ACCOUNT_ID`, `WA_ACCESS_TOKEN`, `META_APP_SECRET`, `WA_WEBHOOK_VERIFY_TOKEN` | from Meta (or leave blank and set them later in **Settings → Connect WhatsApp**) |
| `AUTH_JWT_SECRET` | a 64-char random string |
| `ADMIN_EMAIL` | your admin email |
| `ADMIN_PASSWORD_HASH` | `node scripts/hash-password.mjs 'YourPassword'` |
| `NODE_ENV` | `production` |

See `.env.example` for the full list and defaults.

## 3. Worker service
Add a **second service** from the **same repo**, then override its start command:

```
npm run worker
```

Give it the same `DATABASE_URL`, `REDIS_URL`, and WhatsApp variables as the web
service (no `WA_*` build-time needs — `SKIP_ENV_VALIDATION` lets the image build
without secrets; they're validated at runtime).

## 4. First admin user
After the first deploy, run once (Railway → web service → **Shell**, or a one-off):

```
npm run seed:admin
```

## 5. WhatsApp webhook
Point Meta's webhook callback at `https://<your-web-domain>/api/webhooks/whatsapp`
with your verify token (or configure it all in **Settings → Connect WhatsApp**).

> Keep `WA_MPS × (number of worker replicas) ≤ your Meta tier` to stay within rate limits.
