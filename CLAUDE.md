# CLAUDE.md

This file guides Claude Code (claude.ai/code) when working in this repository.

This is the **My Language Coach** monorepo — an AI voice language-coaching app (Expo mobile + Hono API + Next.js web/admin). It began as a rebuild of a legacy app, but the rebuild is complete and the legacy code is no longer a dependency. See "Legacy stack" at the bottom for the few operational liabilities that still matter.

- **GitHub:** https://github.com/bruno77176/my-language-coach-agentical-rebuild
- **API (prod):** https://my-language-coach-agentical-rebuild.fly.dev (`/health` → 200)
- **Mobile:** shipping to Play Store + TestFlight via EAS (`com.anonymous.mylanguagecoach`).

## Status

Plans 1–8 are essentially shipped. The voice loop, around-voice features, visual identity (Plan 7), and the Plan 8 coaching loop (cross-session coach memory, end-of-session feedback, role-play scenarios, daily quotas, RevenueCat paywall, push notifications, weekly summary) are all in the app, plus vocab flashcards, ElevenLabs per-language voices, 3 CJK languages (15 total), account deletion, and the marketing site.

**The canonical list of what's left lives in `docs/REMAINING-WORK-2026-06-09.md`.** The big open items: real-time voice (voice-live is built but allowlisted/half-duplex; speech-to-speech not built), app-UI i18n, avatar upload, SecureStore migration for auth tokens, and a couple of monetization/coach-memory product decisions.

Plans live in `docs/superpowers/plans/`; the spec is `docs/superpowers/specs/2026-05-09-language-coach-rebuild-design.md`. These plans are templates of tasks — completion is tracked by git history and the code, not by checkboxes in the files.

## Repository layout

pnpm + Turbo monorepo (`pnpm@9`, Node ≥ 20). `cd` into `app/` for everything.

```
apps/
  api/      Hono backend → Fly.io. Drizzle + Supabase Postgres. The voice pipeline lives here.
  mobile/   Expo app (SDK 54, TypeScript, Expo Router). iOS + Android via EAS.
  web/      Next.js marketing site (mylanguagecoach.app) → Vercel.
  admin/    Next.js cost/revenue admin dashboard → Vercel (Supabase magic-link auth).
packages/
  shared/         Zod schemas, TS types, coach prompts, LANGUAGES list, daily-quotes.
  design-tokens/  Sunrise palette + typography tokens (shared mobile/web).
  config/         Shared ESLint + Prettier + tsconfig presets.
```

## Commands

From `app/` (workspace root):

```sh
pnpm format        # prettier --write across the repo
pnpm format:check  # prettier --check (CI gate)
pnpm lint          # turbo run lint
pnpm typecheck     # turbo run typecheck
pnpm test          # turbo run test (vitest)
```

Per-package (use `-F`/`--filter`):

```sh
pnpm -F @language-coach/api dev          # Hono on http://localhost:3000 (tsx --env-file=.env)
pnpm -F @language-coach/api test
pnpm -F @language-coach/api db:generate  # after schema change → creates 0NNN_*.sql
pnpm -F @language-coach/api db:migrate   # apply migrations (NOT drizzle-kit migrate — see below)
pnpm -F @language-coach/api db:verify    # read-only sanity check
```

Mobile (from `apps/mobile/`): `pnpm start` (Metro), then `adb reverse tcp:8081 tcp:8081`. Full device workflow + gotchas in `apps/mobile/DEV.md`.

## Backend (`apps/api/`)

Hono + Drizzle ORM over Supabase Postgres, deployed to Fly.io. ESM, `tsx`-run, Vitest, Sentry, pino logging.

**Migrations:** a custom Node runner (`src/db/run-migrations.ts`), NOT `drizzle-kit migrate`. It tracks applied migrations in `__app_migrations` and applies any `0NNN_*.sql` in `src/db/migrations/` in lexical order — including hand-written SQL (RLS policies, plpgsql functions, seed data) mixed with Drizzle-generated files. **Always `pnpm db:migrate`.** Do NOT rely on `drizzle-kit generate` alone for schema-touching changes that need RLS — hand-write the numbered SQL. The db scripts' `loadEnv()` needs the full prod env to run.

**RLS gotcha:** UPDATE policies need BOTH `USING` and `WITH CHECK`. Without `WITH CHECK`, updates silently affect 0 rows with no error. Verify mutations with `.select()` + a row-count check so silent RLS failures surface.

**Deploy:** push to `main` triggers `.github/workflows/api-deploy.yml` → Fly.io, but only when `apps/api/`, `packages/shared/`, or workspace metadata change.

**Tests:** unit tests run anywhere. Integration tests (`apps/api/tests/integration/`) skip locally — they need a Postgres at `$DATABASE_URL_TEST`; CI provides a service container. Local Docker is blocked on Bruno's corporate Windows machine.

### Voice pipeline (the heart of the product)

A transport-agnostic `runTurn()` drives the cascade, called by both the SSE turns route and the `/v1/voice/live` WebSocket route:

- **STT:** Deepgram. `nova-3` for most langs; **Chinese (`zh`) must route to `nova-2`** (nova-3 lacks zh).
- **LLM:** OpenAI gpt-4o (replies + feedback), gpt-4o-mini (memory extraction).
- **TTS:** provider-agnostic router (`makeSynthesizeSpeech`). Providers: ElevenLabs (per-language native voices, see `voice-map.ts`), Google **Gemini GA** (`gemini-2.5-flash-tts` via Cloud TTS/Vertex service-account OAuth — NOT the AI-Studio preview endpoint), OpenAI `gpt-4o-mini-tts`, Inworld.
- **Live mode:** `/v1/voice/live` WS relay, gated by `VOICE_LIVE_USER_IDS`. Still half-duplex / being stabilized.

## Frontend — mobile (`apps/mobile/`)

Expo SDK 54, Expo Router (file-based routes under `app/`: `(auth)`, `(onboarding)`, `(tabs)`, `(modals)`, `vocab/`). Supabase email+password + Google/Apple sign-in. TanStack Query for server state, Zustand for local stores.

- **Styling: inline `StyleSheet.create({...})`.** NativeWind/Tailwind is installed but its `className` support is broken in this RN setup (see DEV.md) — do NOT add `className`-based styling; use `StyleSheet` like the existing 26 screens.
- **Adding native modules:** `npx expo install <pkg>` (never `pnpm add` — it pins wrong versions). Then from `app/` run `pnpm install` and verify the symlink lands: `ls apps/mobile/node_modules | grep <pkg>`. Skipping this ships an EAS build with the native binary missing. `npx expo-doctor` catches duplicate `react-native-reanimated`/`react-native-worklets` copies, which cause `[runtime not ready]: TypeError: property is not writable` at launch.
- **SSE server message IDs only arrive on the `done` event.** Coach messages start with client IDs (`c-${Date.now()}`); the `done` handler in `use-conversation` MUST swap to the server UUID, or later API calls (translate/share) hit a non-existent row.
- `@gorhom/bottom-sheet` v5: use `BottomSheetFooter` + `bottomInset` for sticky buttons (a `flex:1` ScrollView + sibling footer doesn't render reliably).
- `expo-stream-audio@0.1.3` is patched via `pnpm patch` (`patches/`) — `.record`/`.voiceChat` → OSStatus -50 on iOS; the patch switches to `.playAndRecord`. The Docker/EAS build must copy `patches/` for frozen install to succeed.
- Supabase auth emails ship **numeric OTP codes, not magic links** — any sign-in must use the 2-step `signInWithOtp` → `verifyOtp`. iOS Google sign-in needs Supabase's "Skip nonce checks" ON.

## Frontend — web + admin (Next.js → Vercel)

`apps/web` is the public marketing site (15 locales, EN+FR primary). `apps/admin` is a private cost/revenue dashboard (Supabase magic-link, `ADMIN_USER_IDS` allowlist). There is a known open 500 on the admin dashboard from a server-component cookie write — see `docs/REMAINING-WORK-2026-06-09.md`.

## Important conventions

- **Keep CI green. Run `pnpm format && pnpm lint && pnpm typecheck && pnpm test` from `app/` before every push to `main`.** Never push red. If uncertain, push to a feature branch first. Watch CRLF on Windows (prettier `format:check` covers markdown too).
- `apps/mobile` does NOT load `eslint-plugin-react-hooks` — a `react-hooks/exhaustive-deps` disable _comment_ ERRORS instead of suppressing. Use a prose comment to explain dep-array intent.
- Two sessions committing in one working dir interleave commits onto the same branch — use a **git worktree per concurrent feature**. Keep worktree roots SHORT on Windows (deep paths break the Node ESM resolver even with LongPathsEnabled).
- `eas build:view --json` returns status in UPPERCASE (`FINISHED`). Background `eas build` stdout is buffered (flushes on exit) — check progress with `eas build:list --json`, not the log tail.

## Legacy stack (outside this repo — reference only)

The legacy app lives in sibling folders at the workspace parent (`my-language-coach/`, `my-language-coach-backend/`). It is **reference only — do not invest time fixing legacy bugs unless explicitly asked** (issues are catalogued in the parent `AUDIT.md`). Still-live operational liabilities:

- **OpenAI + Google TTS API keys are still hot in the legacy Render env** — the main security liability. Surface this until Bruno confirms they're rotated.
- **Google Play legacy dev account closure risk by 2026-07-04.**
- Legacy MongoDB Atlas `Cluster0` paused; legacy Render service cold. Dashboards/IDs are in Claude memory (`reference_legacy_dashboards`).
