# My Language Coach — Monorepo

This is the rebuild of the My Language Coach app. See:

- **[Spec](../docs/superpowers/specs/2026-05-09-language-coach-rebuild-design.md)** — full design document.
- **[Audit of legacy app](../AUDIT.md)** — what was wrong with v1.
- **[Stack explained (FR)](../docs/decisions/2026-05-09-stack-explained-fr.md)** — why we chose each tool.

## Status

| Plan                                     | Status  |
| ---------------------------------------- | ------- |
| 1 — Foundation                           | ✓ done  |
| 2 — Backend + Supabase + DB              | ✓ done  |
| 3 — Mobile + auth + onboarding           | ✓ done  |
| 4 — Voice loop                           | ✓ done  |
| 5 — Around-the-voice features            | ✓ done  |
| 6 — Topics + vocab + freemium + push     | pending |
| 7 — Polish + Play Store internal release | pending |

## Layout

```
apps/
  api/          Hono backend (deployed to Fly.io)
  mobile/       Expo app (iOS + Android)
packages/
  shared/       Zod schemas, TS types, prompts, language list
  config/       Shared ESLint + Prettier + tsconfig presets
```

## Backend

The API runs at **https://my-language-coach-agentical-rebuild.fly.dev**.

```bash
curl https://my-language-coach-agentical-rebuild.fly.dev/health
```

### Local dev

```bash
cd apps/api
cp .env.example .env  # then fill in real values from your Supabase + Sentry
pnpm dev              # starts Hono on http://localhost:3000 (uses tsx --env-file=.env)
```

### Migrations

We use a custom Node migration runner (not `drizzle-kit migrate` directly), because we mix
auto-generated Drizzle migrations with hand-written SQL for RLS policies and Postgres
functions. The runner tracks applied migrations in `__app_migrations` instead of
`__drizzle_migrations`. **Always use `pnpm db:migrate` to apply migrations**, not
`drizzle-kit migrate`.

```bash
pnpm -F @language-coach/api db:generate  # after schema changes — creates 0NNN_*.sql
pnpm -F @language-coach/api db:migrate   # applies any unapplied 0NNN_*.sql in order
pnpm -F @language-coach/api db:verify    # read-only sanity check (tables, RLS, functions)
```

Hand-written SQL files (RLS policies, plpgsql functions, seed data) live alongside
generated migrations in `apps/api/src/db/migrations/`. Just drop a `0NNN_descr.sql` file
in there and it'll be picked up by `db:migrate` in lexical order.

### Running tests

Unit tests run anywhere:

```bash
pnpm -F @language-coach/api test
```

Integration tests (in `apps/api/tests/integration/`) skip locally — they need a real
Postgres reachable at `$DATABASE_URL_TEST`. CI provides a Postgres service container.
Local Docker is currently blocked on Bruno's corporate Windows machine (no
`Hyper-V Administrators` rights).

## Frontend

Expo app at `apps/mobile/` (SDK 54, TypeScript, Expo Router). Email + password auth via Supabase.

```bash
cd apps/mobile
pnpm start              # starts Metro on http://localhost:8081
adb reverse tcp:8081 tcp:8081  # USB-tunnel for the dev client (corporate Wi-Fi blocks LAN)
```

Mobile dev workflow + gotchas: see `apps/mobile/DEV.md`.

**Adding native modules:** always use `npx expo install <pkg>` (NOT `pnpm add`) so the SDK-compatible version is picked. After install, run `npx expo-doctor` to verify no duplicate copies of `react-native-*` packages landed in the workspace-root `node_modules` — duplicate copies of `react-native-reanimated` / `react-native-worklets` cause `[runtime not ready]: TypeError: property is not writable` at app launch.

## Deployment

API: `git push` to `main` triggers `.github/workflows/api-deploy.yml`, which deploys to
Fly.io. The workflow only runs when `apps/api/`, `packages/shared/`, or workspace
metadata files change.

Mobile: EAS Update / EAS Build wired in Plan 3.

## Plans

Implementation plans live in `../docs/superpowers/plans/`. This repo is built
plan-by-plan; each plan ends with a green CI run + a verifiable deployable artifact.
