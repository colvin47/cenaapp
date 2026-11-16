#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# This suite is intentionally offline: never run the integration suite that writes to MySQL.
unset TEST_DATABASE_URL

printf '\n[1/7] TypeScript — site/backend\n'
pnpm check

printf '\n[2/7] Unit tests — site/backend (no database integration tests)\n'
pnpm exec vitest run \
  server/auth.logout.test.ts \
  server/collective.invites.test.ts \
  server/commerce.router.test.ts \
  server/moderation.authorization.test.ts \
  server/platform.test.ts \
  client/src/lib/brazil-city-data.test.ts \
  client/src/lib/event-audio-utils.test.ts

printf '\n[3/7] Production build — site/backend\n'
pnpm build

printf '\n[4/7] TypeScript — Expo app\n'
pnpm --dir mobile check

printf '\n[5/7] Unit tests — Expo app (mocked fetch; no real API)\n'
(
  cd mobile
  ../node_modules/.bin/vitest run --config vitest.config.ts
)

printf '\n[6/7] Expo configuration\n'
pnpm --dir mobile exec expo config --json >/dev/null
printf 'Expo config OK.\n'

printf '\n[7/7] Static migration and diff checks (no database connection)\n'
DATABASE_URL='mysql://placeholder:placeholder@127.0.0.1:3306/cena' pnpm drizzle-kit check
git diff --check

printf '\nQA offline concluído. Nenhuma API publicada ou banco de dados foi acessado.\n'
