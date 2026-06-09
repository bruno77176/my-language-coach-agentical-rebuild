# Plan 2 — Backend + Supabase + DB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a working Hono backend on Fly.io with a `/health` endpoint that confirms it can reach Supabase Postgres. The full DB schema (9 tables) and RLS policies live on Supabase. Auth middleware verifies Supabase JWTs. Sentry captures errors. CI deploys on merge to main.

**Architecture:** A single-file-per-route Hono app on Bun, deployed to Fly.io with one machine. Database is Supabase Postgres, queries go through Drizzle ORM. RLS policies and Postgres functions are versioned as raw SQL migrations alongside Drizzle's generated migrations. Auth is delegated to Supabase — the API verifies their JWTs but never issues them.

**Tech Stack:** Hono on Bun, Drizzle ORM, postgres-js, Zod, @supabase/supabase-js (server-side), @sentry/bun, Pino logging, Fly.io for hosting, Supabase for managed Postgres + Auth.

**Working directory:** All paths in this plan are relative to `C:\Users\bruno.moise\My Language Coach - rebuild\app\` unless otherwise stated.

**Branch strategy:** Work directly on `main`. CI gates each merge.

**Spec reference:** `docs/superpowers/specs/2026-05-09-language-coach-rebuild-design.md` §3 (Data model), §4 (API surface), §6 (Observability + CI/CD).

---

## Pre-flight (manual, one-time, user-only)

Before any task runs, the user (Bruno) must complete:

1. **Supabase project**
   - Sign up / log in to https://supabase.com.
   - Create a new project: name `language-coach`, region `eu-west-2` (London) or closest, pick a region near most expected users. Set a strong DB password (save it).
   - Wait ~2 min for provisioning.
   - From Project Settings → API, copy: **Project URL**, **anon key**, **service_role key**.
   - From Project Settings → Database → Connection string → URI (use the **direct connection** for migrations, not the pooler — drizzle-kit needs direct), copy the connection string. It looks like `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxx.supabase.co:5432/postgres`.

2. **Fly.io account**
   - Sign up at https://fly.io. Add a payment method (the free allowance covers a hobby app, but a card is required to provision machines).
   - Install `flyctl`: https://fly.io/docs/hands-on/install-flyctl/. Verify with `flyctl version`.
   - Run `flyctl auth login` (browser flow).

3. **Sentry project**
   - Sign up / log in to https://sentry.io.
   - Create a new project: platform `Node.js`, name `language-coach-api`, alert frequency on every issue.
   - Copy the **DSN** (a URL like `https://abc...@oyyy.ingest.sentry.io/123`).

4. **Docker Desktop**
   - Install if not already: https://docs.docker.com/desktop/install/windows-install/. Used for the Postgres test container in Task 14.

5. **Provide secrets to the executor**
   - Share with the controller (me) the following — I'll write them only into local `.env` files and Fly.io secrets, never into git:
     - `SUPABASE_URL`
     - `SUPABASE_PUBLISHABLE_KEY`
     - `SUPABASE_SECRET_KEY`
     - `DATABASE_URL` (the direct postgres:// connection string)
     - `SENTRY_DSN`

If any of these aren't ready when execution starts, I'll pause and ask.

---

## Task 1: Add API runtime dependencies

**Files:**

- Modify: `app/apps/api/package.json`

- [ ] **Step 1: Install Hono + DB + Supabase + observability packages**

Run from `app/`:

```powershell
pnpm -F @language-coach/api add hono @hono/node-server @supabase/supabase-js drizzle-orm postgres zod pino @sentry/node
pnpm -F @language-coach/api add -D drizzle-kit @types/node tsx
```

Expected: deps added to `apps/api/package.json`. Note: we're using `@hono/node-server` and `@sentry/node` for now (Bun runtime substitution comes in Task 13 when we set up the Dockerfile — Bun is wire-compatible with the Node SDKs but the dev workflow on Windows is smoother on Node).

- [ ] **Step 2: Add scripts to `apps/api/package.json`**

The `scripts` section should become:

```json
"scripts": {
  "typecheck": "tsc --noEmit",
  "lint": "eslint .",
  "test": "vitest run",
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:push": "drizzle-kit push",
  "db:studio": "drizzle-kit studio"
}
```

(Replaces the previous `test: echo` no-op — we're going to write real tests in this plan.)

- [ ] **Step 3: Verify install**

Run from `app/`:

```powershell
pnpm -F @language-coach/api list
```

Expected: all deps listed, no peer-dep warnings.

---

## Task 2: Environment validation with Zod

**Files:**

- Create: `app/apps/api/src/env.ts`
- Create: `app/apps/api/.env.example`

- [ ] **Step 1: Write the failing test**

Create `app/apps/api/src/env.test.ts`:

```ts
import { describe, expect, it, beforeEach } from "vitest";

describe("env", () => {
  beforeEach(() => {
    // Reset module cache so each test gets a fresh env load
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
    delete process.env.DATABASE_URL;
    delete process.env.SENTRY_DSN;
    delete process.env.PORT;
  });

  it("throws a clear error when required vars are missing", async () => {
    await expect(async () => {
      const { loadEnv } = await import("./env");
      loadEnv();
    }).rejects.toThrow(/SUPABASE_URL/);
  });

  it("returns a validated env object when all vars are present", async () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "anon-key-stub";
    process.env.SUPABASE_SECRET_KEY = "service-role-key-stub";
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
    process.env.SENTRY_DSN = "https://stub@sentry.io/1";
    process.env.PORT = "4000";

    const { loadEnv } = await import("./env");
    const env = loadEnv();
    expect(env.SUPABASE_URL).toBe("https://test.supabase.co");
    expect(env.PORT).toBe(4000);
  });

  it("defaults PORT to 3000 if not set", async () => {
    process.env.SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_PUBLISHABLE_KEY = "anon-key-stub";
    process.env.SUPABASE_SECRET_KEY = "service-role-key-stub";
    process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";
    process.env.SENTRY_DSN = "https://stub@sentry.io/1";

    const { loadEnv } = await import("./env");
    const env = loadEnv();
    expect(env.PORT).toBe(3000);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

```powershell
pnpm -F @language-coach/api test
```

Expected: FAIL with "Cannot find module './env'".

- [ ] **Step 3: Write `app/apps/api/src/env.ts`**

```ts
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1), // sb_publishable_... (replaces legacy "anon" key)
  SUPABASE_SECRET_KEY: z.string().min(1), // sb_secret_... (replaces legacy "service_role" key)
  DATABASE_URL: z.string().url(),
  SENTRY_DSN: z.string().url(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}
```

- [ ] **Step 4: Re-run the test**

```powershell
pnpm -F @language-coach/api test
```

Expected: PASS — 3 tests passed.

- [ ] **Step 5: Create `apps/api/.env.example`** — checked into git, no real secrets:

```
NODE_ENV=development
PORT=3000

# From Supabase project settings → API Keys → "Publishable and secret API keys" tab
SUPABASE_URL=https://YOUR-PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR-PUBLISHABLE-KEY
SUPABASE_SECRET_KEY=sb_secret_YOUR-SECRET-KEY

# From Supabase project settings → Database → Connection string (direct, not pooler)
DATABASE_URL=postgresql://postgres:YOUR-PASSWORD@db.YOUR-PROJECT.supabase.co:5432/postgres

# From Sentry project → Settings → Client Keys (DSN)
SENTRY_DSN=https://YOUR-DSN@oNNNNNN.ingest.sentry.io/NNN
```

- [ ] **Step 6: Add `.env` to .gitignore (if not already)** — verify by reading `app/.gitignore`. The Plan 1 .gitignore already has `.env*.local` and `.env`, so this should already be excluded. Just verify.

---

## Task 3: Drizzle setup + DB client

**Files:**

- Create: `app/apps/api/drizzle.config.ts`
- Create: `app/apps/api/src/db/client.ts`
- Create: `app/apps/api/src/db/index.ts`

- [ ] **Step 1: Create `app/apps/api/drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";
import { loadEnv } from "./src/env";

const env = loadEnv();

export default defineConfig({
  schema: "./src/db/schema/*.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
  // RLS policies and SQL functions live in src/db/migrations as hand-written .sql files
  // alongside the auto-generated ones; drizzle-kit applies them in filename order.
  verbose: true,
  strict: true,
});
```

- [ ] **Step 2: Create `app/apps/api/src/db/client.ts`**

```ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Env } from "../env";

export type Database = ReturnType<typeof createDb>;

export function createDb(env: Env) {
  const client = postgres(env.DATABASE_URL, {
    // Supabase pooler: small pool, prepared statements off (PgBouncer compatibility)
    max: 10,
    prepare: false,
  });
  return drizzle(client);
}
```

- [ ] **Step 3: Create `app/apps/api/src/db/index.ts`** (re-export point):

```ts
export { createDb, type Database } from "./client";
```

- [ ] **Step 4: Verify typecheck**

```powershell
pnpm -F @language-coach/api typecheck
```

Expected: exits 0.

---

## Task 4: Drizzle schema for all 9 tables

**Files:**

- Create: `app/apps/api/src/db/schema/profiles.ts`
- Create: `app/apps/api/src/db/schema/conversations.ts`
- Create: `app/apps/api/src/db/schema/messages.ts`
- Create: `app/apps/api/src/db/schema/topics.ts`
- Create: `app/apps/api/src/db/schema/streak-days.ts`
- Create: `app/apps/api/src/db/schema/vocab-items.ts`
- Create: `app/apps/api/src/db/schema/entitlements.ts`
- Create: `app/apps/api/src/db/schema/push-tokens.ts`
- Create: `app/apps/api/src/db/schema/waitlist.ts`
- Create: `app/apps/api/src/db/schema/index.ts`

One file per table per the file-structure principle in the spec. Each file declares the table and its TypeScript types. RLS policies are NOT in these files — they're separate SQL migrations (Task 5).

- [ ] **Step 1: Write a typecheck-only test that imports every schema file**

Create `app/apps/api/src/db/schema/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import * as schema from "./index";

describe("db schema", () => {
  it("exports all 9 tables", () => {
    expect(schema.profiles).toBeDefined();
    expect(schema.conversations).toBeDefined();
    expect(schema.messages).toBeDefined();
    expect(schema.topics).toBeDefined();
    expect(schema.streakDays).toBeDefined();
    expect(schema.vocabItems).toBeDefined();
    expect(schema.entitlements).toBeDefined();
    expect(schema.pushTokens).toBeDefined();
    expect(schema.waitlist).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```powershell
pnpm -F @language-coach/api test
```

Expected: FAIL — "Cannot find module './index'" or similar.

- [ ] **Step 3: Create each schema file**

`app/apps/api/src/db/schema/profiles.ts`:

```ts
import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  userId: uuid("user_id").primaryKey(),
  displayName: text("display_name").notNull(),
  nativeLang: text("native_lang").notNull(),
  targetLang: text("target_lang").notNull(),
  dailyGoalMinutes: integer("daily_goal_minutes").notNull().default(10),
  timezone: text("timezone").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
```

`app/apps/api/src/db/schema/conversations.ts`:

```ts
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { topics } from "./topics";

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    language: text("language").notNull(),
    topicId: uuid("topic_id").references(() => topics.id, {
      onDelete: "set null",
    }),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    secondsSpoken: integer("seconds_spoken").notNull().default(0),
  },
  (t) => ({
    userStartedIdx: index("conversations_user_started_idx").on(
      t.userId,
      t.startedAt.desc(),
    ),
  }),
);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
```

`app/apps/api/src/db/schema/messages.ts`:

```ts
import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { conversations } from "./conversations";

export const messageRole = pgEnum("message_role", ["user", "coach"]);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: messageRole("role").notNull(),
    text: text("text").notNull(),
    translation: text("translation"),
    audioStoragePath: text("audio_storage_path"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    convCreatedIdx: index("messages_conv_created_idx").on(
      t.conversationId,
      t.createdAt,
    ),
  }),
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
```

`app/apps/api/src/db/schema/topics.ts`:

```ts
import { pgTable, uuid, text, boolean, jsonb } from "drizzle-orm/pg-core";

export const topics = pgTable("topics", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id"),
  slug: text("slug").notNull(),
  label: jsonb("label").$type<Record<string, string>>().notNull(),
  systemPromptAddendum: text("system_prompt_addendum").notNull(),
  isBuiltIn: boolean("is_built_in").notNull().default(false),
});

export type Topic = typeof topics.$inferSelect;
export type NewTopic = typeof topics.$inferInsert;
```

`app/apps/api/src/db/schema/streak-days.ts`:

```ts
import {
  pgTable,
  uuid,
  date,
  integer,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const streakDays = pgTable(
  "streak_days",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    date: date("date").notNull(),
    secondsSpoken: integer("seconds_spoken").notNull().default(0),
    goalReached: boolean("goal_reached").notNull().default(false),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.date] }),
  }),
);

export type StreakDay = typeof streakDays.$inferSelect;
export type NewStreakDay = typeof streakDays.$inferInsert;
```

`app/apps/api/src/db/schema/vocab-items.ts`:

```ts
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { messages } from "./messages";

export const vocabItems = pgTable(
  "vocab_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    language: text("language").notNull(),
    term: text("term").notNull(),
    translation: text("translation"),
    firstSeenMessageId: uuid("first_seen_message_id").references(
      () => messages.id,
      {
        onDelete: "set null",
      },
    ),
    mastery: integer("mastery").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userLangTermUnique: unique("vocab_user_lang_term_unique").on(
      t.userId,
      t.language,
      t.term,
    ),
  }),
);

export type VocabItem = typeof vocabItems.$inferSelect;
export type NewVocabItem = typeof vocabItems.$inferInsert;
```

`app/apps/api/src/db/schema/entitlements.ts`:

```ts
import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const entitlements = pgTable("entitlements", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => profiles.userId, { onDelete: "cascade" }),
  plan: text("plan").notNull().default("free"),
  proUntil: timestamp("pro_until", { withTimezone: true }),
  monthlyVoiceSecondsUsed: integer("monthly_voice_seconds_used")
    .notNull()
    .default(0),
  monthlyVoiceSecondsResetAt: timestamp("monthly_voice_seconds_reset_at", {
    withTimezone: true,
  }).notNull(),
});

export type Entitlement = typeof entitlements.$inferSelect;
export type NewEntitlement = typeof entitlements.$inferInsert;
```

`app/apps/api/src/db/schema/push-tokens.ts`:

```ts
import { pgTable, uuid, text, timestamp, unique } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const pushTokens = pgTable(
  "push_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    expoPushToken: text("expo_push_token").notNull(),
    platform: text("platform").notNull(), // 'ios' | 'android' enforced by check constraint in SQL migration
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userTokenUnique: unique("push_tokens_user_token_unique").on(
      t.userId,
      t.expoPushToken,
    ),
  }),
);

export type PushToken = typeof pushTokens.$inferSelect;
export type NewPushToken = typeof pushTokens.$inferInsert;
```

`app/apps/api/src/db/schema/waitlist.ts`:

```ts
import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const waitlist = pgTable("waitlist", {
  email: text("email").primaryKey(),
  userId: uuid("user_id").references(() => profiles.userId, {
    onDelete: "set null",
  }),
  source: text("source").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type WaitlistEntry = typeof waitlist.$inferSelect;
export type NewWaitlistEntry = typeof waitlist.$inferInsert;
```

`app/apps/api/src/db/schema/index.ts`:

```ts
export * from "./profiles";
export * from "./conversations";
export * from "./messages";
export * from "./topics";
export * from "./streak-days";
export * from "./vocab-items";
export * from "./entitlements";
export * from "./push-tokens";
export * from "./waitlist";
```

- [ ] **Step 4: Re-run the schema test**

```powershell
pnpm -F @language-coach/api test
```

Expected: PASS — the schema.test.ts confirms all 9 tables export.

- [ ] **Step 5: Verify typecheck**

```powershell
pnpm -F @language-coach/api typecheck
```

Expected: exits 0.

---

## Task 5: Generate Drizzle migration + write RLS + functions SQL

**Files:**

- Generate: `app/apps/api/src/db/migrations/0000_*.sql` (auto-generated by drizzle-kit)
- Create: `app/apps/api/src/db/migrations/0001_rls_policies.sql`
- Create: `app/apps/api/src/db/migrations/0002_functions.sql`
- Create: `app/apps/api/src/db/migrations/0003_seed_topics.sql`

**Pre-condition:** the user must have provided `DATABASE_URL` via `.env`. Verify before running drizzle-kit.

- [ ] **Step 1: Create the local `.env` for the API**

Copy `apps/api/.env.example` to `apps/api/.env` and fill in real secrets (controller will paste them — they should never be committed).

```powershell
Copy-Item apps\api\.env.example apps\api\.env
```

Then edit `apps/api/.env` with the user's real values.

- [ ] **Step 2: Generate the initial migration**

```powershell
pnpm -F @language-coach/api db:generate
```

Expected: a file like `0000_xxxxxx.sql` is created in `src/db/migrations/`. It contains `CREATE TABLE` statements for all 9 tables.

- [ ] **Step 3: Create `app/apps/api/src/db/migrations/0001_rls_policies.sql`**

```sql
-- Enable RLS on every user-owned table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE streak_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE vocab_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- profiles: select + update own row
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = user_id);
-- INSERT into profiles is restricted to the complete_onboarding RPC (Task below).

-- conversations / messages / vocab_items / streak_days / push_tokens: full CRUD on own rows
CREATE POLICY "conversations_all_own" ON conversations
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "messages_all_own" ON messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()
    )
  );
CREATE POLICY "vocab_items_all_own" ON vocab_items
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "streak_days_all_own" ON streak_days
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "push_tokens_all_own" ON push_tokens
  FOR ALL USING (auth.uid() = user_id);

-- topics: select built-in or own; insert/delete own
CREATE POLICY "topics_select_built_in_or_own" ON topics
  FOR SELECT USING (is_built_in OR auth.uid() = user_id);
CREATE POLICY "topics_insert_own" ON topics
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_built_in = false);
CREATE POLICY "topics_delete_own" ON topics
  FOR DELETE USING (auth.uid() = user_id AND is_built_in = false);

-- entitlements: select own only (writes via service role from backend)
CREATE POLICY "entitlements_select_own" ON entitlements
  FOR SELECT USING (auth.uid() = user_id);

-- waitlist: insert allowed to anyone with valid auth (or anon, see WITH CHECK)
CREATE POLICY "waitlist_insert_any" ON waitlist
  FOR INSERT WITH CHECK (true);

-- Check constraints (Drizzle doesn't generate these for the messages.role enum — done via pgEnum, which is fine — but push_tokens.platform needs one)
ALTER TABLE push_tokens
  ADD CONSTRAINT push_tokens_platform_check CHECK (platform IN ('ios', 'android'));

ALTER TABLE entitlements
  ADD CONSTRAINT entitlements_plan_check CHECK (plan IN ('free', 'pro'));
```

- [ ] **Step 4: Create `app/apps/api/src/db/migrations/0002_functions.sql`**

```sql
-- complete_onboarding: atomic insert of profile + default entitlement
-- Called via supabase.rpc('complete_onboarding', { ... }) from the mobile client.
CREATE OR REPLACE FUNCTION complete_onboarding(
  p_display_name text,
  p_native_lang text,
  p_target_lang text,
  p_daily_goal_minutes int,
  p_timezone text
) RETURNS profiles AS $$
DECLARE
  v_user_id uuid;
  v_profile profiles;
  v_reset_at timestamptz;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Compute the next "first of month at user's timezone" for entitlement reset.
  v_reset_at := date_trunc('month', (now() AT TIME ZONE p_timezone) + interval '1 month')
                AT TIME ZONE p_timezone;

  INSERT INTO profiles (user_id, display_name, native_lang, target_lang, daily_goal_minutes, timezone)
  VALUES (v_user_id, p_display_name, p_native_lang, p_target_lang, p_daily_goal_minutes, p_timezone)
  RETURNING * INTO v_profile;

  INSERT INTO entitlements (user_id, plan, monthly_voice_seconds_used, monthly_voice_seconds_reset_at)
  VALUES (v_user_id, 'free', 0, v_reset_at);

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION complete_onboarding(text, text, text, int, text) TO authenticated;

-- current_streak: count consecutive goal-reached days ending today or yesterday.
CREATE OR REPLACE FUNCTION current_streak() RETURNS int AS $$
DECLARE
  v_user_id uuid;
  v_today date;
  v_yesterday date;
  v_streak int := 0;
  v_check_date date;
  v_user_tz text;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT timezone INTO v_user_tz FROM profiles WHERE user_id = v_user_id;
  IF v_user_tz IS NULL THEN
    RETURN 0;
  END IF;

  v_today := (now() AT TIME ZONE v_user_tz)::date;
  v_yesterday := v_today - interval '1 day';

  -- Streak ends at today or yesterday (one-day grace). Pick the later one with goal_reached=true.
  IF EXISTS (SELECT 1 FROM streak_days WHERE user_id = v_user_id AND date = v_today AND goal_reached) THEN
    v_check_date := v_today;
  ELSIF EXISTS (SELECT 1 FROM streak_days WHERE user_id = v_user_id AND date = v_yesterday AND goal_reached) THEN
    v_check_date := v_yesterday;
  ELSE
    RETURN 0;
  END IF;

  WHILE EXISTS (SELECT 1 FROM streak_days WHERE user_id = v_user_id AND date = v_check_date AND goal_reached) LOOP
    v_streak := v_streak + 1;
    v_check_date := v_check_date - interval '1 day';
  END LOOP;

  RETURN v_streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION current_streak() TO authenticated;
```

- [ ] **Step 5: Create `app/apps/api/src/db/migrations/0003_seed_topics.sql`** — built-in topics seed:

```sql
-- Initial built-in topics catalog. Labels are jsonb keyed by language code.
-- More topics added later via additional migration files.
INSERT INTO topics (slug, label, system_prompt_addendum, is_built_in) VALUES
  ('free-conversation',
   '{"en":"Free conversation","fr":"Conversation libre","de":"Freies Gespräch","es":"Conversación libre","it":"Conversazione libera","pt":"Conversa livre","tr":"Serbest sohbet","sv":"Fritt samtal","da":"Fri samtale","ru":"Свободная беседа","ro":"Conversație liberă","hu":"Szabad beszélgetés"}'::jsonb,
   '',
   true),
  ('ordering-coffee',
   '{"en":"Ordering coffee","fr":"Commander un café","de":"Kaffee bestellen","es":"Pedir un café","it":"Ordinare un caffè","pt":"Pedir um café","tr":"Kahve ısmarlamak","sv":"Beställa kaffe","da":"Bestille kaffe","ru":"Заказать кофе","ro":"A comanda o cafea","hu":"Kávét rendelni"}'::jsonb,
   'Roleplay: you are a barista at a small café. The user is a customer ordering coffee and pastries.',
   true),
  ('job-interview',
   '{"en":"Job interview","fr":"Entretien d''embauche","de":"Vorstellungsgespräch","es":"Entrevista de trabajo","it":"Colloquio di lavoro","pt":"Entrevista de emprego","tr":"İş görüşmesi","sv":"Anställningsintervju","da":"Jobsamtale","ru":"Собеседование","ro":"Interviu de angajare","hu":"Állásinterjú"}'::jsonb,
   'Roleplay: you are a hiring manager interviewing the user for a junior role they applied for.',
   true);
-- (More topics can be added via later migrations without touching this file.)
```

- [ ] **Step 6: Apply migrations to Supabase**

```powershell
pnpm -F @language-coach/api db:migrate
```

Expected: drizzle-kit applies all 4 migration files in order. Output mentions `0000_*`, `0001_rls_policies`, `0002_functions`, `0003_seed_topics`. Exit 0.

- [ ] **Step 7: Verify in Supabase dashboard**

Open Supabase → Table Editor. Confirm all 9 tables exist. Open SQL Editor and run:

```sql
SELECT proname FROM pg_proc WHERE proname IN ('complete_onboarding', 'current_streak');
```

Expected: 2 rows.

```sql
SELECT count(*) FROM topics WHERE is_built_in;
```

Expected: 3.

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN
  ('profiles', 'conversations', 'messages', 'topics', 'streak_days', 'vocab_items', 'entitlements', 'push_tokens', 'waitlist');
```

Expected: 9 rows, all `rowsecurity = true`.

---

## Task 6: Hono app skeleton + /health route

**Files:**

- Create: `app/apps/api/src/app.ts`
- Create: `app/apps/api/src/index.ts` (replaces the placeholder)
- Create: `app/apps/api/src/routes/health.ts`

- [ ] **Step 1: Write the failing test for /health**

Create `app/apps/api/src/routes/health.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../app";

describe("GET /health", () => {
  it("returns 200 with status ok", async () => {
    const env = {
      NODE_ENV: "test" as const,
      PORT: 3000,
      SUPABASE_URL: "https://test.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "anon",
      SUPABASE_SECRET_KEY: "service",
      DATABASE_URL: "postgres://test:test@localhost:5432/test",
      SENTRY_DSN: "https://stub@sentry.io/1",
    };
    const app = createApp(env);
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });
});
```

- [ ] **Step 2: Run, expect failure**

```powershell
pnpm -F @language-coach/api test
```

Expected: FAIL — `Cannot find module '../app'`.

- [ ] **Step 3: Create `app/apps/api/src/routes/health.ts`**

```ts
import { Hono } from "hono";

export const healthRoutes = new Hono();

healthRoutes.get("/", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});
```

- [ ] **Step 4: Create `app/apps/api/src/app.ts`**

```ts
import { Hono } from "hono";
import type { Env } from "./env";
import { healthRoutes } from "./routes/health";

export type AppEnv = {
  Variables: {
    env: Env;
  };
};

export function createApp(env: Env) {
  const app = new Hono<AppEnv>();

  app.use("*", async (c, next) => {
    c.set("env", env);
    await next();
  });

  app.route("/health", healthRoutes);

  return app;
}
```

- [ ] **Step 5: Replace `app/apps/api/src/index.ts`**

```ts
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { loadEnv } from "./env";

const env = loadEnv();
const app = createApp(env);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${info.port}`);
});
```

- [ ] **Step 6: Re-run tests**

```powershell
pnpm -F @language-coach/api test
```

Expected: PASS — health test passes.

- [ ] **Step 7: Run dev server and curl /health**

```powershell
pnpm -F @language-coach/api dev
```

In a separate terminal:

```powershell
curl http://localhost:3000/health
```

Expected: `{"status":"ok","timestamp":"..."}`. Stop the dev server with Ctrl+C.

---

## Task 7: Auth middleware (Supabase JWT verification)

**Files:**

- Create: `app/apps/api/src/middleware/auth.ts`
- Create: `app/apps/api/src/middleware/auth.test.ts`

- [ ] **Step 1: Write the failing test**

Create `app/apps/api/src/middleware/auth.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createAuthMiddleware } from "./auth";

describe("authMiddleware", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const app = new Hono();
    const verify = vi.fn();
    app.use("*", createAuthMiddleware(verify));
    app.get("/", (c) => c.json({ ok: true }));

    const res = await app.request("/");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 when JWT verification throws", async () => {
    const app = new Hono();
    const verify = vi.fn().mockRejectedValue(new Error("bad jwt"));
    app.use("*", createAuthMiddleware(verify));
    app.get("/", (c) => c.json({ ok: true }));

    const res = await app.request("/", {
      headers: { Authorization: "Bearer bad-token" },
    });
    expect(res.status).toBe(401);
  });

  it("attaches userId to context on valid JWT and proceeds", async () => {
    const app = new Hono<{ Variables: { userId: string } }>();
    const verify = vi.fn().mockResolvedValue({ userId: "user-123" });
    app.use("*", createAuthMiddleware(verify));
    app.get("/", (c) => c.json({ userId: c.get("userId") }));

    const res = await app.request("/", {
      headers: { Authorization: "Bearer good-token" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe("user-123");
  });
});
```

- [ ] **Step 2: Confirm fail**

```powershell
pnpm -F @language-coach/api test
```

Expected: FAIL.

- [ ] **Step 3: Create `app/apps/api/src/middleware/auth.ts`**

```ts
import type { MiddlewareHandler } from "hono";

export type VerifyResult = { userId: string };
export type Verifier = (token: string) => Promise<VerifyResult>;

export function createAuthMiddleware(verify: Verifier): MiddlewareHandler<{
  Variables: { userId: string };
}> {
  return async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Missing Authorization header",
          },
        },
        401,
      );
    }
    const token = authHeader.slice("Bearer ".length);

    try {
      const { userId } = await verify(token);
      c.set("userId", userId);
      await next();
    } catch {
      return c.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid token" } },
        401,
      );
    }
  };
}
```

- [ ] **Step 4: Re-run tests**

```powershell
pnpm -F @language-coach/api test
```

Expected: PASS — 3 auth tests + previous tests all pass.

- [ ] **Step 5: Create the real Supabase verifier**

Create `app/apps/api/src/lib/supabase-verifier.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import type { Env } from "../env";
import type { Verifier } from "../middleware/auth";

export function createSupabaseVerifier(env: Env): Verifier {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY);

  return async (token) => {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      throw new Error(error?.message ?? "Invalid Supabase JWT");
    }
    return { userId: data.user.id };
  };
}
```

We don't write a unit test for this — it's a thin adapter and is exercised by Task 8 via real integration tests.

---

## Task 8: Error handler middleware

**Files:**

- Create: `app/apps/api/src/middleware/error.ts`
- Create: `app/apps/api/src/middleware/error.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// app/apps/api/src/middleware/error.test.ts
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { errorHandler } from "./error";

describe("errorHandler", () => {
  it("returns 500 + INTERNAL for unhandled errors", async () => {
    const onError = vi.fn();
    const app = new Hono();
    app.onError(errorHandler(onError));
    app.get("/", () => {
      throw new Error("boom");
    });

    const res = await app.request("/");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL");
    expect(body.error.message).toBeTruthy();
    // Must NOT leak stack trace
    expect(JSON.stringify(body)).not.toContain("at Object");
    expect(onError).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Confirm fail.** `pnpm -F @language-coach/api test`.

- [ ] **Step 3: Create `app/apps/api/src/middleware/error.ts`**

```ts
import type { ErrorHandler } from "hono";

type ReportError = (err: unknown) => void;

export function errorHandler(report: ReportError): ErrorHandler {
  return (err, c) => {
    report(err);
    return c.json(
      {
        error: {
          code: "INTERNAL",
          message: "An unexpected error occurred",
        },
      },
      500,
    );
  };
}
```

- [ ] **Step 4: Re-run tests, expect green.** `pnpm -F @language-coach/api test`.

---

## Task 9: Pino logging middleware + Sentry init

**Files:**

- Create: `app/apps/api/src/lib/logger.ts`
- Create: `app/apps/api/src/lib/sentry.ts`
- Create: `app/apps/api/src/middleware/logging.ts`
- Modify: `app/apps/api/src/app.ts` (wire logger + error handler)
- Modify: `app/apps/api/src/index.ts` (init Sentry before serving)

- [ ] **Step 1: Create `app/apps/api/src/lib/logger.ts`**

```ts
import pino from "pino";
import type { Env } from "../env";

export function createLogger(env: Env) {
  return pino({
    level: env.NODE_ENV === "production" ? "info" : "debug",
    base: { env: env.NODE_ENV },
    transport:
      env.NODE_ENV === "development"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  });
}

export type Logger = ReturnType<typeof createLogger>;
```

(Need to add `pino-pretty` as a devDep — included in Step 4.)

- [ ] **Step 2: Create `app/apps/api/src/lib/sentry.ts`**

```ts
import * as Sentry from "@sentry/node";
import type { Env } from "../env";

export function initSentry(env: Env) {
  if (env.NODE_ENV === "test") return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}

export function reportError(err: unknown, context?: Record<string, unknown>) {
  Sentry.captureException(err, { extra: context });
}
```

- [ ] **Step 3: Create `app/apps/api/src/middleware/logging.ts`**

```ts
import type { MiddlewareHandler } from "hono";
import { randomUUID } from "node:crypto";
import type { Logger } from "../lib/logger";

export function createLoggingMiddleware(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const requestId = randomUUID();
    const start = Date.now();
    const log = logger.child({
      requestId,
      route: c.req.path,
      method: c.req.method,
    });
    c.set("logger", log);

    await next();

    const durationMs = Date.now() - start;
    log.info({ status: c.res.status, durationMs }, "request completed");
  };
}
```

- [ ] **Step 4: Add deps**

```powershell
pnpm -F @language-coach/api add pino
pnpm -F @language-coach/api add -D pino-pretty
```

(`@sentry/node` was added in Task 1.)

- [ ] **Step 5: Wire everything in `app/apps/api/src/app.ts`**

Replace the file contents with:

```ts
import { Hono } from "hono";
import type { Env } from "./env";
import { createLogger, type Logger } from "./lib/logger";
import { reportError } from "./lib/sentry";
import { createLoggingMiddleware } from "./middleware/logging";
import { errorHandler } from "./middleware/error";
import { healthRoutes } from "./routes/health";

export type AppEnv = {
  Variables: {
    env: Env;
    logger: Logger;
  };
};

export function createApp(env: Env) {
  const app = new Hono<AppEnv>();
  const logger = createLogger(env);

  app.use("*", async (c, next) => {
    c.set("env", env);
    await next();
  });

  app.use("*", createLoggingMiddleware(logger));

  app.onError(errorHandler(reportError));

  app.route("/health", healthRoutes);

  return app;
}
```

- [ ] **Step 6: Update `app/apps/api/src/index.ts`**

```ts
import { serve } from "@hono/node-server";
import { createApp } from "./app";
import { loadEnv } from "./env";
import { initSentry } from "./lib/sentry";

const env = loadEnv();
initSentry(env);
const app = createApp(env);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${info.port}`);
});
```

- [ ] **Step 7: Verify all tests still pass**

```powershell
pnpm -F @language-coach/api test
pnpm -F @language-coach/api typecheck
```

Expected: both exit 0.

- [ ] **Step 8: Run dev and observe pretty logs**

```powershell
pnpm -F @language-coach/api dev
```

In another terminal: `curl http://localhost:3000/health` a few times. Check the dev terminal — colored Pino output with `requestId`, `status`, `durationMs`. Stop with Ctrl+C.

---

## Task 10: /health upgrade — verify DB connectivity

**Files:**

- Modify: `app/apps/api/src/routes/health.ts`
- Modify: `app/apps/api/src/routes/health.test.ts`
- Modify: `app/apps/api/src/app.ts` (inject db client)

- [ ] **Step 1: Update the test**

Replace `app/apps/api/src/routes/health.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app";

const baseEnv = {
  NODE_ENV: "test" as const,
  PORT: 3000,
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "anon",
  SUPABASE_SECRET_KEY: "service",
  DATABASE_URL: "postgres://test:test@localhost:5432/test",
  SENTRY_DSN: "https://stub@sentry.io/1",
};

describe("GET /health", () => {
  it("returns 200 with status=ok and dbOk=true when DB ping succeeds", async () => {
    const fakeDb = { execute: vi.fn().mockResolvedValue([{ ok: 1 }]) };
    const app = createApp(baseEnv, fakeDb as never);
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.dbOk).toBe(true);
  });

  it("returns 503 with dbOk=false when DB ping fails", async () => {
    const fakeDb = {
      execute: vi.fn().mockRejectedValue(new Error("conn lost")),
    };
    const app = createApp(baseEnv, fakeDb as never);
    const res = await app.request("/health");
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.status).toBe("degraded");
    expect(body.dbOk).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect fail (signature change to createApp).**

- [ ] **Step 3: Update `app/apps/api/src/app.ts`** to accept db:

```ts
import { Hono } from "hono";
import type { Env } from "./env";
import type { Database } from "./db";
import { createDb } from "./db";
import { createLogger, type Logger } from "./lib/logger";
import { reportError } from "./lib/sentry";
import { createLoggingMiddleware } from "./middleware/logging";
import { errorHandler } from "./middleware/error";
import { createHealthRoutes } from "./routes/health";

export type AppEnv = {
  Variables: {
    env: Env;
    logger: Logger;
    db: Database;
  };
};

export function createApp(env: Env, db: Database = createDb(env)) {
  const app = new Hono<AppEnv>();
  const logger = createLogger(env);

  app.use("*", async (c, next) => {
    c.set("env", env);
    c.set("db", db);
    await next();
  });

  app.use("*", createLoggingMiddleware(logger));

  app.onError(errorHandler(reportError));

  app.route("/health", createHealthRoutes(db));

  return app;
}
```

- [ ] **Step 4: Update `app/apps/api/src/routes/health.ts`**

```ts
import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { Database } from "../db";

export function createHealthRoutes(db: Database) {
  const routes = new Hono();

  routes.get("/", async (c) => {
    let dbOk = false;
    try {
      await db.execute(sql`SELECT 1`);
      dbOk = true;
    } catch {
      dbOk = false;
    }

    if (!dbOk) {
      return c.json(
        { status: "degraded", dbOk, timestamp: new Date().toISOString() },
        503,
      );
    }
    return c.json({ status: "ok", dbOk, timestamp: new Date().toISOString() });
  });

  return routes;
}
```

- [ ] **Step 5: Re-run tests**

```powershell
pnpm -F @language-coach/api test
```

Expected: PASS — both /health tests pass.

- [ ] **Step 6: Manual verification against real Supabase**

```powershell
pnpm -F @language-coach/api dev
curl http://localhost:3000/health
```

Expected: `{"status":"ok","dbOk":true,"timestamp":"..."}`. Confirms the dev server connects to your real Supabase Postgres.

---

## Task 11: Lint cleanup + commit

- [ ] **Step 1: Run the full local pipeline**

```powershell
cd ..  # back to app/
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
```

Fix any failures (unused imports, formatting, etc.) and re-run until all 4 exit 0.

- [ ] **Step 2: Commit**

```powershell
git add .
git commit -m @'
feat(api): scaffold Hono backend with auth + DB + observability (Plan 2 part 1)

- Hono app skeleton on @hono/node-server (Bun runtime in Task 13)
- Drizzle schema for all 9 tables (profiles, conversations, messages,
  topics, streak_days, vocab_items, entitlements, push_tokens, waitlist)
- Initial migration applied to Supabase: tables, RLS policies on every
  user-owned table, complete_onboarding + current_streak SQL functions,
  3 built-in topics seeded
- Env validation with Zod (loadEnv with friendly error messages)
- Auth middleware (Supabase JWT verifier, abstracted for testability)
- Error handler middleware (no stack trace leaks, reports to Sentry)
- Pino logging middleware (per-request requestId, route, status, durationMs)
- Sentry init (skipped in NODE_ENV=test)
- /health endpoint that pings DB (200 ok, 503 degraded)

Refs: docs/superpowers/specs/2026-05-09-language-coach-rebuild-design.md (Plan 2 of 7)
'@
git push
```

- [ ] **Step 3: Verify CI passes**

```powershell
gh run watch --repo bruno77176/my-language-coach-agentical-rebuild
```

Expected: green.

---

## Task 12: Test infrastructure for integration tests (CI-only — local Docker blocked)

**Reframed 2026-05-09:** the user's machine is a domain-joined corporate Windows where WSL2 cannot create Hyper-V VMs (lacks `Hyper-V Administrators` membership; Windows error `0x80070569`). Rancher Desktop / Docker Desktop / any container runtime that needs WSL2 won't start. We're routing integration tests through CI's GitHub Actions Postgres service container instead of running locally. Local dev runs only unit tests.

If the user later gains Hyper-V access (IT ticket) or moves to a personal machine, we can add the local docker-compose option back without changing the test code itself — only the test invocation needs a `DATABASE_URL_TEST` env var.

**Files:**

- Create: `app/apps/api/docker-compose.yml` (local-only, gitignored? no — committed)
- Create: `app/apps/api/vitest.config.ts`
- Create: `app/apps/api/tests/setup.ts`
- Create: `app/apps/api/tests/integration/health.integration.test.ts`

- [ ] **Step 1: Add Vitest as a real dep + supertest equivalent**

```powershell
pnpm -F @language-coach/api add -D vitest @vitest/coverage-v8
```

(We replaced the no-op test script with `vitest run` in Task 1, so vitest is needed now.)

- [ ] **Step 2: Create `app/apps/api/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.integration.test.ts",
        "src/index.ts",
        "src/db/migrations/**",
        "src/db/schema/index.ts",
      ],
    },
  },
});
```

- [ ] **Step 3: Create `app/apps/api/tests/setup.ts`**

```ts
// Global test setup. Loaded once per Vitest run.
// Right now: ensures NODE_ENV=test so Sentry init is skipped, etc.
process.env.NODE_ENV = "test";
```

- [ ] **Step 4: Create `app/apps/api/docker-compose.yml`** for a local Postgres for integration tests:

```yaml
services:
  postgres-test:
    image: postgres:16-alpine
    container_name: language-coach-postgres-test
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: language_coach_test
    ports:
      - "54320:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test -d language_coach_test"]
      interval: 2s
      timeout: 2s
      retries: 10
```

(Port 54320 to avoid conflict with any local pg on 5432.)

- [ ] **Step 5: Create `app/apps/api/tests/integration/health.integration.test.ts`**

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { createDb } from "../../src/db";
import postgres from "postgres";

const TEST_DB_URL = "postgres://test:test@localhost:54320/language_coach_test";

const env = {
  NODE_ENV: "test" as const,
  PORT: 3000,
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "anon",
  SUPABASE_SECRET_KEY: "service",
  DATABASE_URL: TEST_DB_URL,
  SENTRY_DSN: "https://stub@sentry.io/1",
};

describe("integration: /health against real Postgres", () => {
  let raw: ReturnType<typeof postgres>;

  beforeAll(async () => {
    // Sanity: ensure DB is reachable before running. Failure here means docker-compose isn't up.
    raw = postgres(TEST_DB_URL, { max: 1 });
    await raw`SELECT 1`;
  });

  afterAll(async () => {
    await raw.end();
  });

  it("returns 200 ok against real DB", async () => {
    const db = createDb(env);
    const app = createApp(env, db);
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dbOk).toBe(true);
  });
});
```

- [ ] **Step 6: Add an npm script to start the test DB easily**

In `apps/api/package.json`, add to `scripts`:

```json
"test:db:up": "docker-compose up -d postgres-test",
"test:db:down": "docker-compose down -v"
```

- [ ] **Step 7: Verify integration test runs**

```powershell
pnpm -F @language-coach/api test:db:up
# Wait ~5s for Postgres to be ready
pnpm -F @language-coach/api test
```

Expected: all tests (unit + integration) pass.

```powershell
pnpm -F @language-coach/api test:db:down
```

To tear down.

- [ ] **Step 8: Commit**

```powershell
git add .
git commit -m "test(api): add Vitest + dockerized Postgres for integration tests"
git push
```

---

## Task 13: Fly.io deployment config

**Files:**

- Create: `app/apps/api/Dockerfile`
- Create: `app/apps/api/.dockerignore`
- Create: `app/apps/api/fly.toml`

**Pre-condition:** flyctl installed, `flyctl auth login` done (per Pre-flight §2).

- [ ] **Step 1: Create `app/apps/api/Dockerfile`** — multi-stage Bun build:

```dockerfile
# Stage 1: build
FROM oven/bun:1-alpine AS builder
WORKDIR /app

# Copy package metadata for the whole monorepo (needed for pnpm workspace resolution)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/

RUN bun install --frozen-lockfile

# Copy source
COPY apps/api apps/api
COPY packages/shared packages/shared

# Build TypeScript
RUN cd apps/api && bun run build

# Stage 2: runtime
FROM oven/bun:1-alpine AS runtime
WORKDIR /app

COPY --from=builder /app/apps/api/dist /app/dist
COPY --from=builder /app/apps/api/package.json /app/package.json
COPY --from=builder /app/node_modules /app/node_modules

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["bun", "run", "/app/dist/index.js"]
```

(Build context is the monorepo root, not `apps/api`. We'll set the build context in `fly.toml` accordingly.)

- [ ] **Step 2: Create `app/apps/api/.dockerignore`**

```
node_modules
dist
.turbo
.expo
coverage
**/*.test.ts
**/*.integration.test.ts
**/.env
**/.env.local
docker-compose.yml
.git
```

- [ ] **Step 3: Create `app/apps/api/fly.toml`**

```toml
app = "language-coach-api"
primary_region = "lhr"  # London — change if you picked a different Supabase region

[build]
  dockerfile = "apps/api/Dockerfile"
  # Build context is the monorepo root, two levels up from this file
  ignorefile = "apps/api/.dockerignore"

[env]
  NODE_ENV = "production"
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "off"
  auto_start_machines = true
  min_machines_running = 1
  processes = ["app"]

  [http_service.concurrency]
    type = "requests"
    soft_limit = 200
    hard_limit = 250

  [[http_service.checks]]
    interval = "30s"
    timeout = "5s"
    grace_period = "10s"
    method = "GET"
    path = "/health"

[vm]
  size = "shared-cpu-1x"
  memory_mb = 256
```

- [ ] **Step 4: Create the Fly.io app + set secrets**

```powershell
cd ../..  # back to monorepo root (because the Dockerfile context is the root)
flyctl apps create language-coach-api --org personal
```

If the name is taken, suffix with your initials and update `fly.toml` accordingly.

Set secrets (use the values you collected in Pre-flight):

```powershell
flyctl secrets set --app language-coach-api `
  SUPABASE_URL="https://YOUR-PROJECT.supabase.co" `
  SUPABASE_PUBLISHABLE_KEY="YOUR-ANON" `
  SUPABASE_SECRET_KEY="YOUR-SERVICE-ROLE" `
  DATABASE_URL="postgres://..." `
  SENTRY_DSN="https://..."
```

- [ ] **Step 5: Initial deploy**

From the monorepo root (`app/`):

```powershell
flyctl deploy --app language-coach-api --config apps/api/fly.toml
```

Expected: builds the Docker image, pushes, deploys to one machine, healthcheck passes within ~30s.

- [ ] **Step 6: Verify the prod endpoint**

```powershell
curl https://language-coach-api.fly.dev/health
```

Expected: `{"status":"ok","dbOk":true,"timestamp":"..."}`. If 503, check `flyctl logs --app language-coach-api`.

---

## Task 14: GitHub Actions deploy workflow

**Files:**

- Create: `app/.github/workflows/api-deploy.yml`

- [ ] **Step 1: Generate a Fly.io deploy token**

Manual (controller asks user to run):

```powershell
flyctl tokens create deploy --name "github-actions-language-coach-api" --app language-coach-api
```

Copy the token (starts with `FlyV1 fm2_...`).

- [ ] **Step 2: Add the token to GitHub secrets**

```powershell
gh secret set FLY_API_TOKEN --repo bruno77176/my-language-coach-agentical-rebuild --body "FlyV1 fm2_..."
```

- [ ] **Step 3: Create `app/.github/workflows/api-deploy.yml`**

```yaml
name: API Deploy

on:
  push:
    branches: [main]
    paths:
      - "apps/api/**"
      - "packages/shared/**"
      - ".github/workflows/api-deploy.yml"

concurrency:
  group: api-deploy
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: superfly/flyctl-actions/setup-flyctl@master

      - name: Deploy to Fly.io
        run: flyctl deploy --app language-coach-api --config apps/api/fly.toml --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

- [ ] **Step 4: Commit + push + verify deploy fires**

```powershell
git add .
git commit -m "ci(api): add Fly.io deploy workflow on push to main"
git push
gh run watch --repo bruno77176/my-language-coach-agentical-rebuild
```

Expected: both `CI` and `API Deploy` workflows run; both green. After deploy, re-curl the health endpoint to confirm the new commit is live.

---

## Task 15: Update root README + final commit

**Files:**

- Modify: `app/README.md`

- [ ] **Step 1: Update `app/README.md`**

Add to the existing README:

```markdown
## Status

| Plan                        | Status  |
| --------------------------- | ------- |
| 1 — Foundation              | ✓ done  |
| 2 — Backend + Supabase + DB | ✓ done  |
| 3-7                         | pending |

## Backend

The API runs at `https://language-coach-api.fly.dev`. Health check:

\`\`\`bash
curl https://language-coach-api.fly.dev/health
\`\`\`

Local dev:

\`\`\`bash
cd apps/api
cp .env.example .env # then fill in real values from your Supabase + Sentry
pnpm dev # starts Hono on http://localhost:3000
\`\`\`

Migrations:

\`\`\`bash
pnpm -F @language-coach/api db:generate # after schema changes
pnpm -F @language-coach/api db:migrate # applies pending migrations
\`\`\`

Integration tests need a local Postgres:

\`\`\`bash
pnpm -F @language-coach/api test:db:up # starts dockerized Postgres on :54320
pnpm -F @language-coach/api test
pnpm -F @language-coach/api test:db:down
\`\`\`
```

- [ ] **Step 2: Commit**

```powershell
git add README.md
git commit -m "docs: update README with backend status + local dev"
git push
```

---

## Plan completion checklist

When all 15 tasks are checked off:

- [ ] `https://language-coach-api.fly.dev/health` returns 200 with `dbOk: true`.
- [ ] Supabase Table Editor shows all 9 tables with `rowsecurity = true`.
- [ ] `complete_onboarding` and `current_streak` functions exist and are grantable to `authenticated`.
- [ ] 3 built-in topics seeded (`free-conversation`, `ordering-coffee`, `job-interview`).
- [ ] `apps/api` has unit tests (env, schema, health, auth, error) all passing.
- [ ] Integration test with dockerized Postgres passes locally.
- [ ] `pnpm typecheck && pnpm lint && pnpm format:check && pnpm test` all green.
- [ ] CI (`ci.yml`) green on the latest `main` commit.
- [ ] API Deploy workflow (`api-deploy.yml`) successfully ran on the latest `main` commit.

If all 9 are true, **Plan 2 is done** and you can hand off to Plan 3 (Mobile + auth + onboarding).

---

## What's deliberately not in Plan 2

- **No real product API endpoints** — only `/health`. Voice routes come in Plan 4. Translation in Plan 5. Vocab + topics in Plan 6.
- **No anon-allowed routes** — every business endpoint will require auth. Webhooks (billing) come later.
- **No rate limiting middleware** — added in Plan 4 alongside the voice routes (where it actually matters).
- **No CORS lock-down** — added in Plan 3 when we know the mobile app's bundle ID origin scheme.
- **No Supabase CLI / local Auth** — local Postgres is sufficient for now. If integration tests grow to need real Auth, we add `supabase start` in Plan 4.
- **No fallback STT/LLM/TTS providers** — Plan 4 deals with provider integration.
- **No Bun runtime in dev** — Bun on Windows is improving but Node.js + tsx is smoother for the dev loop. Production runs on Bun via the Dockerfile.
