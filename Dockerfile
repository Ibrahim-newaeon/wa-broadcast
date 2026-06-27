# syntax=docker/dockerfile:1
# ── Stage 1: deps ────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ── Stage 2: build ───────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Skip env validation at build time — real secrets are injected at runtime
# (compose env_file / Railway service variables).
ENV SKIP_ENV_VALIDATION=1
RUN npx prisma generate && npm run build

# ── Stage 3: runtime ─────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# non-root user
RUN addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/.next ./.next
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/src ./src
COPY --from=build --chown=app:app /app/scripts ./scripts
COPY --from=build --chown=app:app /app/package.json ./package.json

USER app
# Informational; the app actually listens on $PORT (Railway injects it; falls
# back to 3000 for local/compose).
EXPOSE 3000

# Health check hits the app's /api/health endpoint on the runtime port.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT:-3000}/api/health" || exit 1

# Default = web on $PORT (Railway) / 3000 (local), bound to :: for IPv6 reach.
# docker-compose / railway.json override this command per service.
CMD ["sh", "-c", "npx next start -H :: -p ${PORT:-3000}"]
