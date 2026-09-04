# Broadcast Hub Project Guide

Broadcast Hub is the V1 self-hosted, multi-tenant WhatsApp messaging product built on Meta Cloud API. It is distinct from the V2 **whatsapphub** repository; do not copy V2 migrations, scope, or status into this project.

The stack is Next.js, strict TypeScript, Prisma/PostgreSQL, BullMQ/Redis, Zod, Vitest, Playwright, and Docker Compose. Web and worker processes share the codebase.

## Sources of truth

Use implementation and tests first, then **ARCHITECTURE.md**, **README.md**, **package.json**, Prisma migrations, and **HANDOFF.md**. The file **whatsapphub-V2.md** is roadmap/reference material, not proof that a feature exists here.

## Commands

~~~bash
npm ci
npm run prisma:generate
npm run typecheck
npm test
npm run build
npm run dev
npm run worker:dev
npm run test:e2e
~~~

For a full local stack, copy **.env.example** and run **docker compose up --build**. Create Prisma migrations with **npm run prisma:migrate -- --name description**; deploy existing migrations with **npm run prisma:deploy**.

## Invariants

- Scope every tenant-owned query and mutation using the established authenticated tenant context.
- Validate API bodies, CSV rows, and webhook payloads with Zod.
- Verify Meta webhook signatures before processing; keep event handling idempotent and retry-safe.
- Honor opt-outs and approved-template rules. Do not bypass consent or invent delivery success.
- Keep middleware edge-safe: do not import Prisma, Redis token storage, or Node-only modules into it.
- Preserve refresh-token rotation/revocation and server-side role checks.
- BullMQ rate limits are per worker; account for total workers against the Meta messaging tier.
- Use Prisma rather than interpolated raw SQL, and append migration history.
- Use existing CSS variables and bilingual EN/AR patterns; preserve RTL, accessibility, and status clarity.

A change is complete only after type checking, unit tests, build, and relevant E2E checks pass. Do not claim a deployment or Meta connection was verified unless it was checked in the current environment.
