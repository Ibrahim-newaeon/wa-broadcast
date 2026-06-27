#!/usr/bin/env bash
# Offline verification — no DB/Redis needed. Run before committing.
# Usage: ./verify.sh
set -euo pipefail

cd "$(dirname "$0")"

step() { printf "\n\033[1;36m▶ %s\033[0m\n" "$1"; }

step "1/4 Install dependencies"
npm install

step "2/4 Generate Prisma client"
npm run prisma:generate

step "3/4 Type-check (tsc --noEmit)"
npm run typecheck

step "4/4 Unit tests (vitest)"
npm test

printf "\n\033[1;32m✓ Offline checks passed.\033[0m\n"
printf "Next: cp .env.example .env  →  docker compose up --build  →  npm run test:e2e\n"
