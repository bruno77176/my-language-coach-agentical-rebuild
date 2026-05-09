# My Language Coach — Monorepo

This is the rebuild of the My Language Coach app. See:

- **[Spec](../docs/superpowers/specs/2026-05-09-language-coach-rebuild-design.md)** — full design document.
- **[Audit of legacy app](../AUDIT.md)** — what was wrong with v1.
- **[Stack explained (FR)](../docs/decisions/2026-05-09-stack-explained-fr.md)** — why we chose each tool.

## Layout

```
apps/
  api/          Hono backend (deployed to Fly.io)
  mobile/       Expo app (iOS + Android)
packages/
  shared/       Zod schemas, TS types, prompts, language list
  config/       Shared ESLint + Prettier + tsconfig presets
```

## Local dev

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
```

## Plans

Implementation plans live in `../docs/superpowers/plans/`. This repo is built plan-by-plan; this is **Plan 1 (Foundation)**.
