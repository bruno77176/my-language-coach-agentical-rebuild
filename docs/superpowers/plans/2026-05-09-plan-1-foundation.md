# Plan 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an empty pnpm + Turborepo monorepo at `app/` with TypeScript, ESLint, Prettier, Vitest, and a green GitHub Actions CI pipeline. No product code yet — Plans 2-7 build on top of this scaffold.

**Architecture:** A monorepo with two empty app packages (`apps/api`, `apps/mobile`) and two utility packages (`packages/shared`, `packages/config`). Turborepo orchestrates `typecheck`, `lint`, `test` across all packages. ESLint + Prettier + tsconfig presets live in `packages/config` and are extended by every other package. CI runs the full pipeline on every push and PR.

**Tech Stack:** pnpm (workspaces), Turborepo, TypeScript 5.x, ESLint 9 (flat config), Prettier 3, Vitest 2.x, GitHub Actions.

**Working directory:** All paths in this plan are relative to `C:\Users\bruno.moise\My Language Coach - rebuild\app\` unless otherwise stated. The plan document itself lives at the workspace root in `docs/superpowers/plans/`.

**Shell:** PowerShell (per the user's environment). Commands use cross-shell tools (`pnpm`, `git`, `mkdir`) where possible.

**Spec reference:** `docs/superpowers/specs/2026-05-09-language-coach-rebuild-design.md` §2 (Repo structure + tech inventory).

---

## Pre-flight (one-time, manual)

Before running any tasks, the user (Bruno) must:

1. Confirm `pnpm` is installed: `pnpm --version` → expect `9.x` or `10.x`. If missing: `npm install -g pnpm`.
2. Confirm `node` is `>=20`: `node --version`.
3. Confirm `git` is configured: `git config user.name` and `git config user.email` both return values.
4. Have a GitHub account and be authenticated via `gh auth status` (GitHub CLI). If `gh` not installed, install it.

If any of these fails, fix before starting Task 1.

---

## Task 1: Create the monorepo root + pnpm workspace

**Files:**

- Create: `app/package.json`
- Create: `app/pnpm-workspace.yaml`
- Create: `app/.npmrc`

- [ ] **Step 1: Create the monorepo root directory**

Run from the workspace root (`C:\Users\bruno.moise\My Language Coach - rebuild\`):

```powershell
mkdir app
cd app
```

Expected: `app/` exists; current directory is `app/`.

- [ ] **Step 2: Create `app/package.json`**

Write file `app/package.json` with this exact content:

```json
{
  "name": "language-coach-monorepo",
  "version": "0.0.0",
  "private": true,
  "description": "Monorepo for the My Language Coach app (rebuild)",
  "engines": {
    "node": ">=20",
    "pnpm": ">=9"
  },
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "build": "turbo run build",
    "format": "prettier --write \"**/*.{ts,tsx,js,json,md,yml,yaml}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,json,md,yml,yaml}\""
  }
}
```

- [ ] **Step 3: Create `app/pnpm-workspace.yaml`**

Write file `app/pnpm-workspace.yaml` with this exact content:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 4: Create `app/.npmrc`**

Write file `app/.npmrc` with this exact content:

```ini
auto-install-peers=true
strict-peer-dependencies=false
shamefully-hoist=false
```

- [ ] **Step 5: Run pnpm install (creates the lockfile)**

Run from `app/`:

```powershell
pnpm install
```

Expected: `Lockfile created` message, `pnpm-lock.yaml` exists, `node_modules/` created. Zero packages installed (no deps yet).

- [ ] **Step 6: No commit yet — git init happens in Task 12**

Skip. We commit everything together at the end of the plan.

---

## Task 2: Set up Turborepo

**Files:**

- Create: `app/turbo.json`
- Modify: `app/package.json` (add turbo to devDependencies via pnpm)

- [ ] **Step 1: Add turbo to the root**

Run from `app/`:

```powershell
pnpm add -Dw turbo
```

Expected: `turbo` added to `devDependencies` in `app/package.json`. Lockfile updated.

- [ ] **Step 2: Create `app/turbo.json`**

Write file `app/turbo.json` with this exact content:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "typecheck": {
      "dependsOn": ["^typecheck"],
      "outputs": []
    },
    "lint": {
      "dependsOn": ["^lint"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^test"],
      "outputs": ["coverage/**"]
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".expo/**"]
    }
  }
}
```

- [ ] **Step 3: Verify turbo runs (with no tasks defined yet)**

Run from `app/`:

```powershell
pnpm turbo run typecheck
```

Expected: `No tasks were executed as part of this run.` Exit code 0.

This confirms turbo is installed and reads `turbo.json` correctly. Real tasks are added by later tasks.

---

## Task 3: Root TypeScript baseline

**Files:**

- Create: `app/tsconfig.base.json`

- [ ] **Step 1: Create `app/tsconfig.base.json`**

Write file `app/tsconfig.base.json` with this exact content:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "incremental": true
  },
  "exclude": ["node_modules", "dist", "build", ".expo", ".turbo"]
}
```

This is the base every package's `tsconfig.json` extends. The strict flags (`noUncheckedIndexedAccess`, `noImplicitOverride`) catch real bugs that the legacy code suffered from.

---

## Task 4: Create `packages/config` (shared tooling configs)

**Files:**

- Create: `app/packages/config/package.json`
- Create: `app/packages/config/eslint.base.mjs`
- Create: `app/packages/config/prettier.config.cjs`
- Create: `app/packages/config/tsconfig.base.json`

- [ ] **Step 1: Create the directory**

Run from `app/`:

```powershell
mkdir packages\config
```

- [ ] **Step 2: Create `app/packages/config/package.json`**

Write file with this exact content:

```json
{
  "name": "@language-coach/config",
  "version": "0.0.0",
  "private": true,
  "description": "Shared ESLint, Prettier, and TypeScript presets",
  "type": "module",
  "exports": {
    "./eslint": "./eslint.base.mjs",
    "./prettier": "./prettier.config.cjs",
    "./tsconfig.base.json": "./tsconfig.base.json"
  },
  "files": ["eslint.base.mjs", "prettier.config.cjs", "tsconfig.base.json"],
  "dependencies": {
    "@typescript-eslint/eslint-plugin": "^8.18.0",
    "@typescript-eslint/parser": "^8.18.0",
    "eslint": "^9.17.0",
    "prettier": "^3.4.2",
    "typescript-eslint": "^8.18.0"
  }
}
```

- [ ] **Step 3: Create `app/packages/config/eslint.base.mjs`**

Write file with this exact content:

```js
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "build/**",
      "node_modules/**",
      ".expo/**",
      ".turbo/**",
      "coverage/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
);
```

- [ ] **Step 4: Create `app/packages/config/prettier.config.cjs`**

Write file with this exact content:

```js
/** @type {import("prettier").Config} */
module.exports = {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  arrowParens: "always",
  endOfLine: "lf",
};
```

- [ ] **Step 5: Create `app/packages/config/tsconfig.base.json`**

Write file with this exact content:

```json
{
  "extends": "../../tsconfig.base.json"
}
```

This package's tsconfig is just a re-export so other packages can write `"extends": "@language-coach/config/tsconfig"` in their own tsconfig.

- [ ] **Step 6: Install the config package's deps**

Run from `app/`:

```powershell
pnpm install
```

Expected: ESLint, Prettier, typescript-eslint installed under `packages/config/node_modules/` (and hoisted as appropriate).

---

## Task 5: Create `packages/shared` (placeholder)

**Files:**

- Create: `app/packages/shared/package.json`
- Create: `app/packages/shared/tsconfig.json`
- Create: `app/packages/shared/eslint.config.mjs`
- Create: `app/packages/shared/src/index.ts`

- [ ] **Step 1: Create the directory**

Run from `app/`:

```powershell
mkdir packages\shared\src
```

- [ ] **Step 2: Create `app/packages/shared/package.json`**

Write file with this exact content:

```json
{
  "name": "@language-coach/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "devDependencies": {
    "@language-coach/config": "workspace:*",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 3: Create `app/packages/shared/tsconfig.json`**

Write file with this exact content:

```json
{
  "extends": "@language-coach/config/tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Create `app/packages/shared/eslint.config.mjs`**

Write file with this exact content:

```js
import config from "@language-coach/config/eslint";
export default config;
```

- [ ] **Step 5: Create `app/packages/shared/src/index.ts`**

Write file with this exact content:

```ts
export {};
```

Placeholder. Real exports (Zod schemas, types, prompts, languages) come in Plan 2.

- [ ] **Step 6: Install + verify typecheck passes**

Run from `app/`:

```powershell
pnpm install
pnpm -F @language-coach/shared typecheck
```

Expected: Install completes, typecheck exits 0 with no output.

---

## Task 6: Create `apps/api` (placeholder)

**Files:**

- Create: `app/apps/api/package.json`
- Create: `app/apps/api/tsconfig.json`
- Create: `app/apps/api/eslint.config.mjs`
- Create: `app/apps/api/src/index.ts`

- [ ] **Step 1: Create the directory**

Run from `app/`:

```powershell
mkdir apps\api\src
```

- [ ] **Step 2: Create `app/apps/api/package.json`**

Write file with this exact content:

```json
{
  "name": "@language-coach/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "test": "vitest run"
  },
  "dependencies": {
    "@language-coach/shared": "workspace:*"
  },
  "devDependencies": {
    "@language-coach/config": "workspace:*",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 3: Create `app/apps/api/tsconfig.json`**

Write file with this exact content:

```json
{
  "extends": "@language-coach/config/tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: Create `app/apps/api/eslint.config.mjs`**

Write file with this exact content:

```js
import config from "@language-coach/config/eslint";
export default config;
```

- [ ] **Step 5: Create `app/apps/api/src/index.ts`**

Write file with this exact content:

```ts
// Placeholder. Real Hono server scaffolded in Plan 2.
export const apiVersion = "0.0.0";
```

- [ ] **Step 6: Install + verify**

Run from `app/`:

```powershell
pnpm install
pnpm -F @language-coach/api typecheck
```

Expected: Install completes, typecheck exits 0.

---

## Task 7: Create `apps/mobile` (placeholder)

**Files:**

- Create: `app/apps/mobile/package.json`
- Create: `app/apps/mobile/README.md`

- [ ] **Step 1: Create the directory**

Run from `app/`:

```powershell
mkdir apps\mobile
```

- [ ] **Step 2: Create `app/apps/mobile/package.json`**

Write file with this exact content. **Note:** this is a minimal placeholder. Plan 3 runs `pnpm create expo-app` to scaffold the real Expo app, which will replace this `package.json`.

```json
{
  "name": "@language-coach/mobile",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "typecheck": "echo \"Mobile typecheck wired in Plan 3\" && exit 0",
    "lint": "echo \"Mobile lint wired in Plan 3\" && exit 0",
    "test": "echo \"Mobile tests wired in Plan 3\" && exit 0"
  }
}
```

- [ ] **Step 3: Create `app/apps/mobile/README.md`**

Write file with this exact content:

```markdown
# @language-coach/mobile

Placeholder. The Expo app is scaffolded in **Plan 3** via `pnpm create expo-app`.

Until then, this package's scripts are no-ops so Turborepo's CI pipeline stays green.
```

- [ ] **Step 4: Install + verify scripts run**

Run from `app/`:

```powershell
pnpm install
pnpm -F @language-coach/mobile typecheck
pnpm -F @language-coach/mobile lint
pnpm -F @language-coach/mobile test
```

Expected: each prints the placeholder message and exits 0.

---

## Task 8: Wire Vitest in `packages/shared` with a passing sample test

**Files:**

- Modify: `app/packages/shared/package.json` (add vitest dep)
- Create: `app/packages/shared/vitest.config.ts`
- Create: `app/packages/shared/src/identity.ts`
- Create: `app/packages/shared/src/identity.test.ts`

- [ ] **Step 1: Add Vitest as a dev dependency in shared**

Run from `app/`:

```powershell
pnpm -F @language-coach/shared add -D vitest @vitest/coverage-v8
```

Expected: `vitest` and `@vitest/coverage-v8` added to `packages/shared/package.json`.

- [ ] **Step 2: Create `app/packages/shared/vitest.config.ts`**

Write file with this exact content:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
    },
  },
});
```

- [ ] **Step 3: Write the failing test first**

Write file `app/packages/shared/src/identity.test.ts` with this exact content:

```ts
import { describe, expect, it } from "vitest";
import { identity } from "./identity";

describe("identity", () => {
  it("returns its argument unchanged", () => {
    expect(identity(42)).toBe(42);
    expect(identity("hello")).toBe("hello");
  });
});
```

- [ ] **Step 4: Run the test to confirm it fails**

Run from `app/`:

```powershell
pnpm -F @language-coach/shared test
```

Expected: FAIL — "Cannot find module './identity'" (or similar).

- [ ] **Step 5: Write the minimal implementation**

Write file `app/packages/shared/src/identity.ts` with this exact content:

```ts
/** Returns its argument unchanged. Sample function used to verify the test runner is wired up. */
export function identity<T>(value: T): T {
  return value;
}
```

- [ ] **Step 6: Re-export from index and re-run the test**

Edit `app/packages/shared/src/index.ts` to be:

```ts
export { identity } from "./identity";
```

Run from `app/`:

```powershell
pnpm -F @language-coach/shared test
```

Expected: PASS — 1 test passed.

- [ ] **Step 7: Verify typecheck still passes**

Run from `app/`:

```powershell
pnpm -F @language-coach/shared typecheck
```

Expected: exits 0.

---

## Task 9: Verify ESLint runs cleanly across all packages

**Files:** none new — validates Task 4 setup.

- [ ] **Step 1: Run lint on the whole monorepo**

Run from `app/`:

```powershell
pnpm lint
```

Expected: turbo runs `lint` on every package; all pass with no warnings.

If any errors appear (likely about the placeholder code), fix them in this task by adjusting the file content. Do not ignore lint errors — the goal is a green baseline.

- [ ] **Step 2: Run prettier check**

Run from `app/`:

```powershell
pnpm format:check
```

Expected: every file matches Prettier's formatting.

If any files are mis-formatted, run `pnpm format` to fix, then re-run `pnpm format:check`.

---

## Task 10: Verify the full Turborepo pipeline runs green

**Files:** none new — end-to-end validation.

- [ ] **Step 1: Run the full pipeline**

Run from `app/`:

```powershell
pnpm typecheck
pnpm lint
pnpm test
```

Expected: each command exits 0. The test run should report "1 passed" (the `identity` test in shared).

- [ ] **Step 2: Verify Turborepo is caching**

Run any of the three commands a second time:

```powershell
pnpm test
```

Expected: turbo reports `cache hit` for `@language-coach/shared#test` and finishes in <1s.

If caching doesn't work, do not move on — investigate `turbo.json` and the package's `outputs` config. Caching is critical for CI speed in later plans.

---

## Task 11: GitHub Actions CI workflow

**Files:**

- Create: `app/.github/workflows/ci.yml`

- [ ] **Step 1: Create the directory**

Run from `app/`:

```powershell
mkdir .github\workflows
```

- [ ] **Step 2: Create `app/.github/workflows/ci.yml`**

Write file with this exact content:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Format check
        run: pnpm format:check

      - name: Test
        run: pnpm test
```

This workflow runs on every PR and on pushes to `main`. The `concurrency` block cancels superseded runs to save CI minutes.

---

## Task 12: Initialize git, commit, push, verify CI passes

**Files:**

- Create: `app/.gitignore`
- Create: `app/README.md`

**Pre-conditions for this task** (verified by the controller before dispatching):

- The user has run `gh auth login` for the `bruno77176` GitHub account, and `gh auth status` confirms it's the active account when the push happens. If the active account is `brunoacn` (work), `gh auth switch -u bruno77176` first.
- The remote repo already exists: `https://github.com/bruno77176/my-language-coach-agentical-rebuild`.

- [ ] **Step 1: Create `app/.gitignore`**

Write file with this exact content:

```gitignore
# Dependencies
node_modules/

# Build output
dist/
build/
.turbo/
.expo/

# Coverage
coverage/

# Env
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Sentry
.sentryclirc
```

- [ ] **Step 2: Create `app/README.md`**

Write file with this exact content:

```markdown
# My Language Coach — Monorepo

This is the rebuild of the My Language Coach app. See:

- **[Spec](../docs/superpowers/specs/2026-05-09-language-coach-rebuild-design.md)** — full design document.
- **[Audit of legacy app](../AUDIT.md)** — what was wrong with v1.
- **[Stack explained (FR)](../docs/decisions/2026-05-09-stack-explained-fr.md)** — why we chose each tool.

## Layout

\`\`\`
apps/
api/ Hono backend (deployed to Fly.io)
mobile/ Expo app (iOS + Android)
packages/
shared/ Zod schemas, TS types, prompts, language list
config/ Shared ESLint + Prettier + tsconfig presets
\`\`\`

## Local dev

\`\`\`bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
\`\`\`

## Plans

Implementation plans live in \`../docs/superpowers/plans/\`. This repo is built plan-by-plan; this is **Plan 1 (Foundation)**.
```

- [ ] **Step 3: Initialize git**

Run from `app/`:

```powershell
git init -b main
```

Expected: `Initialized empty Git repository in .../app/.git/`. Default branch is `main`.

- [ ] **Step 4: Set repo-local git author identity**

Run from `app/`:

```powershell
git config user.name "Bruno Moise"
git config user.email "bruno.a.moise@gmail.com"
```

This sets the identity for **this repo only** — does not touch the global config (which is the work identity `bruno.moise@accenture.com`).

Verify:

```powershell
git config user.name
git config user.email
```

Expected output: `Bruno Moise` then `bruno.a.moise@gmail.com`.

- [ ] **Step 5: Stage and commit**

Run from `app/`:

```powershell
git add .
git status
```

Expected: every file you've created in this plan is shown as `new file:`. No `.env` files, no `node_modules/`.

If `node_modules/` appears, the `.gitignore` is wrong — fix it before continuing.

Commit using a HEREDOC for proper formatting:

```powershell
git commit -m @'
chore: scaffold monorepo foundation (Plan 1)

- pnpm workspaces + Turborepo
- TypeScript 5.7 baseline (strict, noUncheckedIndexedAccess)
- ESLint 9 + Prettier 3 presets in @language-coach/config
- Vitest 2.x with sample test in @language-coach/shared
- GitHub Actions CI: typecheck, lint, format check, test
- Empty placeholders for @language-coach/api and @language-coach/mobile

Refs: docs/superpowers/specs/2026-05-09-language-coach-rebuild-design.md (Plan 1 of 7)
'@
```

Expected: commit succeeds. `git log --oneline` shows one commit. `git log -1 --format='%an <%ae>'` shows `Bruno Moise <bruno.a.moise@gmail.com>`.

- [ ] **Step 6: Add the existing remote**

The repo already exists on GitHub (created manually by the user). Add it as `origin`:

```powershell
git remote add origin https://github.com/bruno77176/my-language-coach-agentical-rebuild.git
git remote -v
```

Expected: `origin` listed twice (fetch + push) pointing at the GitHub URL.

- [ ] **Step 7: Verify gh is authenticated as the right account, then push**

Run from `app/`:

```powershell
gh auth status
```

Expected: `Active account: true` against the `bruno77176` account. If `brunoacn` is active, switch first:

```powershell
gh auth switch -u bruno77176
```

Then push:

```powershell
git push -u origin main
```

Expected: push succeeds. If credential prompts appear, gh's git credential helper should fill them automatically (`gh auth setup-git` if not already done).

- [ ] **Step 8: Verify CI passes**

Run from `app/`:

```powershell
gh run list --repo bruno77176/my-language-coach-agentical-rebuild --limit 1
```

Expected: a workflow run is queued or in progress. Wait ~1-2 minutes, then:

```powershell
gh run watch --repo bruno77176/my-language-coach-agentical-rebuild
```

Expected: all 4 steps (typecheck, lint, format check, test) pass. Final status: ✓ success.

If CI fails, do **not** mark this task complete. Investigate the failure (`gh run view --log-failed --repo bruno77176/my-language-coach-agentical-rebuild`), fix locally, re-commit, push, re-verify.

---

## Plan completion checklist

When all 12 tasks are checked off:

- [ ] Local `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` all exit 0.
- [ ] Remote `main` branch on GitHub has one commit.
- [ ] CI workflow on that commit shows ✓ green.
- [ ] `app/` directory is tracked by git; `app/node_modules/` is not.
- [ ] `apps/api`, `apps/mobile`, `packages/shared`, `packages/config` all exist with valid `package.json`.

If all five are true, **Plan 1 is done** and you can hand off to Plan 2 (Backend + Supabase + DB).

---

## What's deliberately not in Plan 1

- **No real product code.** Every package is a placeholder.
- **No Sentry, PostHog, or any analytics yet** — wired in Plan 2 (api) and Plan 3 (mobile).
- **No Expo scaffold** — `apps/mobile` gets `pnpm create expo-app` in Plan 3, which will replace its placeholder `package.json`.
- **No deployment workflow.** Fly.io deploy CI is added in Plan 2 when there's something to deploy.
- **No EAS Build / EAS Update workflow** — added in Plan 3 when the Expo app exists.
- **No Supabase project, no Drizzle, no DB.** Plan 2 owns that.
