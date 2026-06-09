# Plan 5: Around-the-voice features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the screens and features that surround the voice loop — daily-quote home with progress + start CTA, streak heatmap progress tab, editable profile, in-chat translation, and OS-share-sheet conversation export.

**Architecture:** Mostly client-side. One new backend route (`POST /v1/messages/:id/translate`), one new SQL migration (`0004`) that adds two RPCs (`get_progress_summary`, `clear_my_translations`). New shared module `daily-quotes.ts` ships 50 hand-curated quotes pre-translated into all 12 supported languages. Mobile gets four real screens replacing four stubs, plus translation + share enhancements on the existing Practice screen.

**Tech Stack:** Hono on Bun (API), Drizzle/postgres-js (DB), Supabase Postgres + RLS, Expo SDK 54 + Expo Router (mobile), TanStack Query (server state), Zustand (local state), @gorhom/bottom-sheet (new dep for profile edit sheets), Vitest for tests across the board.

**Spec:** `docs/superpowers/specs/2026-05-10-plan-5-around-the-voice-design.md`

---

## File map

**Backend (new):**

- `apps/api/src/db/migrations/0004_plan_5_rpcs.sql` — `get_progress_summary`, `clear_my_translations`, helper `longest_streak` if missing
- `apps/api/src/routes/messages.ts` — translate route
- `apps/api/src/routes/messages.test.ts` — route tests

**Backend (modify):**

- `apps/api/src/app.ts` — wire translate route
- `apps/api/src/db/verify-migrations.ts` — expand `EXPECTED_FUNCTIONS`

**Shared (new):**

- `packages/shared/src/daily-quotes.ts` — types, data, `quoteForDay`
- `packages/shared/src/daily-quotes.test.ts`

**Shared (modify):**

- `packages/shared/src/index.ts` — re-export daily-quotes

**Mobile — home (new):**

- `apps/mobile/src/features/home/quote-card.tsx`
- `apps/mobile/src/features/home/today-progress.tsx`
- `apps/mobile/src/features/home/use-today-stats.ts`
- `apps/mobile/src/features/home/quote-card.test.tsx`

**Mobile — progress (new):**

- `apps/mobile/src/features/progress/heatmap.tsx`
- `apps/mobile/src/features/progress/stats-row.tsx`
- `apps/mobile/src/features/progress/use-progress-summary.ts`
- `apps/mobile/src/features/progress/heatmap.test.tsx`

**Mobile — profile (new):**

- `apps/mobile/src/features/profile/profile-row.tsx`
- `apps/mobile/src/features/profile/edit-name-sheet.tsx`
- `apps/mobile/src/features/profile/edit-language-sheet.tsx`
- `apps/mobile/src/features/profile/edit-goal-sheet.tsx`
- `apps/mobile/src/features/profile/use-update-profile.ts`
- `apps/mobile/src/lib/toast.ts`
- `apps/mobile/src/features/profile/use-update-profile.test.ts`

**Mobile — chat enhancements (new):**

- `apps/mobile/src/features/practice/api-translate.ts`
- `apps/mobile/src/features/practice/use-translate-message.ts`
- `apps/mobile/src/features/practice/build-transcript.ts`
- `apps/mobile/src/features/practice/build-transcript.test.ts`
- `apps/mobile/src/features/practice/share-button.tsx`

**Mobile (replace stubs / modify):**

- `apps/mobile/app/(tabs)/home.tsx` — replace stub
- `apps/mobile/app/(tabs)/progress.tsx` — replace stub
- `apps/mobile/app/(tabs)/profile.tsx` — replace existing
- `apps/mobile/app/(tabs)/practice.tsx` — add ShareButton to top bar + track startedAt
- `apps/mobile/src/features/practice/MessageBubble.tsx` — add tap-to-translate
- `apps/mobile/src/lib/api-client.ts` — export `authHeader` + `API_BASE_URL`

---

## Phase 1 — Backend foundation

### Task 1: SQL migration `0004_plan_5_rpcs.sql`

**Files:**

- Create: `apps/api/src/db/migrations/0004_plan_5_rpcs.sql`
- Modify: `apps/api/src/db/verify-migrations.ts`

- [ ] **Step 1: Confirm `current_streak` exists, locate signature**

Run: `grep -n "current_streak\|longest_streak" apps/api/src/db/migrations/0002_functions.sql`

If `longest_streak(user_id)` is not present, this task adds it. If it is, skip the helper portion of step 2.

- [ ] **Step 2: Write the migration SQL**

Create `apps/api/src/db/migrations/0004_plan_5_rpcs.sql` with:

```sql
-- Plan 5 RPCs: progress summary + translation cache reset.
-- All functions are SECURITY INVOKER and scope by auth.uid() so RLS-equivalent
-- isolation holds even when called via supabase.rpc().

-- Helper: longest streak across all of a user's history.
-- Idempotent re-create.
create or replace function longest_streak(p_user_id uuid)
returns int
language sql
stable
security invoker
as $$
  with goal_days as (
    select date
    from streak_days
    where user_id = p_user_id and goal_reached = true
    order by date
  ),
  groups as (
    select date, date - (row_number() over (order by date))::int as grp
    from goal_days
  ),
  runs as (
    select count(*)::int as len from groups group by grp
  )
  select coalesce(max(len), 0) from runs;
$$;

-- Main RPC: returns the heatmap window + aggregate stats in one call.
create or replace function get_progress_summary()
returns jsonb
language plpgsql
stable
security invoker
as $$
declare
  v_user uuid := auth.uid();
  v_tz text;
  v_today date;
  v_window_start date;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select timezone into v_tz from profiles where user_id = v_user;
  if v_tz is null then v_tz := 'UTC'; end if;

  v_today := (now() at time zone v_tz)::date;
  v_window_start := v_today - interval '83 days';

  return jsonb_build_object(
    'current_streak', (select current_streak()),
    'longest_streak', longest_streak(v_user),
    'total_minutes', coalesce(
      (select (sum(seconds_spoken) / 60)::int from streak_days where user_id = v_user),
      0
    ),
    'week_minutes', coalesce(
      (select (sum(seconds_spoken) / 60)::int
       from streak_days
       where user_id = v_user and date >= v_today - interval '6 days'),
      0
    ),
    'total_sessions', (
      select count(*)::int from conversations
      where user_id = v_user and ended_at is not null
    ),
    'days', coalesce(
      (select jsonb_agg(jsonb_build_object(
        'date', to_char(date, 'YYYY-MM-DD'),
        'seconds_spoken', seconds_spoken,
        'goal_reached', goal_reached
      ) order by date)
      from streak_days
      where user_id = v_user and date >= v_window_start),
      '[]'::jsonb
    )
  );
end;
$$;

-- Wipe cached translations on a user's messages. Used when native_lang changes.
create or replace function clear_my_translations()
returns void
language plpgsql
security invoker
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  update messages
  set translation = null
  from conversations
  where messages.conversation_id = conversations.id
    and conversations.user_id = v_user
    and messages.translation is not null;
end;
$$;
```

- [ ] **Step 3: Update `verify-migrations.ts`**

Modify `apps/api/src/db/verify-migrations.ts` line 24:

```ts
const EXPECTED_FUNCTIONS = [
  "complete_onboarding",
  "current_streak",
  "get_progress_summary",
  "longest_streak",
  "clear_my_translations",
];
```

(Remove `longest_streak` from the list if step 1 confirmed it already existed in `0002_functions.sql`.)

- [ ] **Step 4: Run the migration locally against the dev DB**

```bash
cd apps/api
pnpm tsx src/db/run-migrations.ts
```

Expected: prints `applied 0004_plan_5_rpcs.sql` (or similar). No errors.

- [ ] **Step 5: Verify**

```bash
pnpm tsx src/db/verify-migrations.ts
```

Expected: `get_progress_summary`, `longest_streak`, `clear_my_translations` all listed in `== FUNCTIONS ==`.

- [ ] **Step 6: Smoke-test the RPC in psql or via Supabase SQL editor**

Run in Supabase SQL editor (signed in as Bruno):

```sql
select get_progress_summary();
```

Expected: returns a JSON object with `current_streak`, `longest_streak`, `total_minutes`, `week_minutes`, `total_sessions`, `days` (likely empty array if no recent practice).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/db/migrations/0004_plan_5_rpcs.sql apps/api/src/db/verify-migrations.ts
git commit -m "feat(api): add progress_summary + clear_my_translations RPCs (Plan 5)"
```

---

### Task 2: Translate route with full TDD

**Files:**

- Create: `apps/api/src/routes/messages.ts`
- Create: `apps/api/src/routes/messages.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/routes/messages.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createMessagesRoutes, type MessagesDeps } from "./messages";

const userId = "00000000-0000-0000-0000-000000000001";
const messageId = "11111111-1111-1111-1111-111111111111";
const conversationId = "22222222-2222-2222-2222-222222222222";

function appWithMessages(routes: ReturnType<typeof createMessagesRoutes>) {
  const app = new Hono<{ Variables: { userId: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", userId);
    await next();
  });
  app.route("/v1/messages", routes);
  return app;
}

function makeFakeDb(opts: {
  message: {
    id: string;
    role: "user" | "coach";
    text: string;
    translation: string | null;
    conversationId: string;
    conversationUserId: string;
  } | null;
  profile: { nativeLang: string } | null;
}) {
  return {
    query: {
      messages: {
        findFirst: vi.fn().mockResolvedValue(
          opts.message
            ? {
                id: opts.message.id,
                role: opts.message.role,
                text: opts.message.text,
                translation: opts.message.translation,
                conversation: {
                  id: opts.message.conversationId,
                  userId: opts.message.conversationUserId,
                },
              }
            : null,
        ),
      },
      profiles: {
        findFirst: vi.fn().mockResolvedValue(opts.profile),
      },
    },
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  };
}

describe("POST /v1/messages/:id/translate", () => {
  it("returns cached translation without calling LLM when present", async () => {
    const db = makeFakeDb({
      message: {
        id: messageId,
        role: "coach",
        text: "Buongiorno",
        translation: "Bonjour",
        conversationId,
        conversationUserId: userId,
      },
      profile: { nativeLang: "fr" },
    });
    const translate = vi.fn();
    const routes = createMessagesRoutes({ db: db as never, translate });
    const app = appWithMessages(routes);

    const res = await app.request(`/v1/messages/${messageId}/translate`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ translation: "Bonjour" });
    expect(translate).not.toHaveBeenCalled();
  });

  it("calls LLM, caches, and returns translation on cache miss", async () => {
    const db = makeFakeDb({
      message: {
        id: messageId,
        role: "coach",
        text: "Buongiorno",
        translation: null,
        conversationId,
        conversationUserId: userId,
      },
      profile: { nativeLang: "fr" },
    });
    const translate = vi.fn().mockResolvedValue("Bonjour");
    const routes = createMessagesRoutes({ db: db as never, translate });
    const app = appWithMessages(routes);

    const res = await app.request(`/v1/messages/${messageId}/translate`, {
      method: "POST",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ translation: "Bonjour" });
    expect(translate).toHaveBeenCalledWith({
      text: "Buongiorno",
      targetLanguageCode: "fr",
    });
    expect(db.update).toHaveBeenCalled();
  });

  it("returns 404 when message does not exist", async () => {
    const db = makeFakeDb({ message: null, profile: { nativeLang: "fr" } });
    const routes = createMessagesRoutes({
      db: db as never,
      translate: vi.fn(),
    });
    const app = appWithMessages(routes);
    const res = await app.request(`/v1/messages/${messageId}/translate`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when message belongs to another user", async () => {
    const db = makeFakeDb({
      message: {
        id: messageId,
        role: "coach",
        text: "x",
        translation: null,
        conversationId,
        conversationUserId: "99999999-9999-9999-9999-999999999999",
      },
      profile: { nativeLang: "fr" },
    });
    const routes = createMessagesRoutes({
      db: db as never,
      translate: vi.fn(),
    });
    const app = appWithMessages(routes);
    const res = await app.request(`/v1/messages/${messageId}/translate`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });

  it("returns 422 when message role is user (not coach)", async () => {
    const db = makeFakeDb({
      message: {
        id: messageId,
        role: "user",
        text: "Buongiorno",
        translation: null,
        conversationId,
        conversationUserId: userId,
      },
      profile: { nativeLang: "fr" },
    });
    const routes = createMessagesRoutes({
      db: db as never,
      translate: vi.fn(),
    });
    const app = appWithMessages(routes);
    const res = await app.request(`/v1/messages/${messageId}/translate`, {
      method: "POST",
    });
    expect(res.status).toBe(422);
    expect((await res.json()) as { error: { code: string } }).toMatchObject({
      error: { code: "NOT_TRANSLATABLE" },
    });
  });

  it("returns 503 when LLM fails", async () => {
    const db = makeFakeDb({
      message: {
        id: messageId,
        role: "coach",
        text: "Buongiorno",
        translation: null,
        conversationId,
        conversationUserId: userId,
      },
      profile: { nativeLang: "fr" },
    });
    const translate = vi.fn().mockRejectedValue(new Error("openai down"));
    const routes = createMessagesRoutes({ db: db as never, translate });
    const app = appWithMessages(routes);
    const res = await app.request(`/v1/messages/${messageId}/translate`, {
      method: "POST",
    });
    expect(res.status).toBe(503);
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
cd apps/api && pnpm test messages
```

Expected: fails with `Cannot find module './messages'` or similar.

- [ ] **Step 3: Implement the route**

Create `apps/api/src/routes/messages.ts`:

```ts
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { messages } from "../db/schema/messages";

export type TranslateInput = { text: string; targetLanguageCode: string };
export type TranslateFn = (input: TranslateInput) => Promise<string>;

export type MessagesDeps = {
  db: Database;
  translate: TranslateFn;
};

export function createMessagesRoutes(deps: MessagesDeps) {
  const app = new Hono<{ Variables: { userId: string } }>();

  app.post("/:id/translate", async (c) => {
    const messageId = c.req.param("id");
    const userId = c.get("userId");

    const message = await deps.db.query.messages.findFirst({
      where: (m, { eq: eqOp }) => eqOp(m.id, messageId),
      with: { conversation: true },
    });

    if (!message || message.conversation.userId !== userId) {
      return c.json({ error: { code: "NOT_FOUND" } }, 404);
    }

    if (message.role !== "coach") {
      return c.json({ error: { code: "NOT_TRANSLATABLE" } }, 422);
    }

    if (message.translation) {
      return c.json({ translation: message.translation });
    }

    const profile = await deps.db.query.profiles.findFirst({
      where: (p, { eq: eqOp }) => eqOp(p.userId, userId),
    });
    if (!profile) {
      return c.json({ error: { code: "PROFILE_MISSING" } }, 404);
    }

    let translation: string;
    try {
      translation = await deps.translate({
        text: message.text,
        targetLanguageCode: profile.nativeLang,
      });
    } catch {
      return c.json({ error: { code: "LLM_PROVIDER_FAILURE" } }, 503);
    }

    await deps.db
      .update(messages)
      .set({ translation })
      .where(eq(messages.id, messageId));

    return c.json({ translation });
  });

  return app;
}
```

- [ ] **Step 4: Confirm Drizzle relation `messages.conversation` is defined**

Run: `grep -n "conversation" apps/api/src/db/schema/messages.ts`

If `messages` doesn't have a `relations()` linking to `conversations`, add it. The `findFirst({ with: { conversation: true } })` query needs the relation. If missing, add at the end of `messages.ts`:

```ts
import { relations } from "drizzle-orm";
import { conversations } from "./conversations";

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
}));
```

And ensure the relation is exported in `apps/api/src/db/schema/index.ts`.

- [ ] **Step 5: Run tests, confirm they pass**

```bash
pnpm test messages
```

Expected: 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/messages.ts apps/api/src/routes/messages.test.ts apps/api/src/db/schema/
git commit -m "feat(api): add POST /v1/messages/:id/translate (Plan 5)"
```

---

### Task 3: Wire translate route into the app + add `translateMessage` provider

**Files:**

- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/providers/openai.ts` (add `translateMessage` helper)

- [ ] **Step 1: Add `translateMessage` to `providers/openai.ts`**

The file already imports `OpenAI` and exports `streamChatCompletion` + `synthesizeSpeechOpenAI`. Append at the bottom of `apps/api/src/providers/openai.ts`:

```ts
import { LANGUAGES } from "@language-coach/shared";

export type TranslateMessageInput = {
  text: string;
  targetLanguageCode: string;
};

export async function translateMessage(
  client: OpenAI,
  input: TranslateMessageInput,
): Promise<string> {
  const lang = LANGUAGES.find((l) => l.code === input.targetLanguageCode);
  const targetName = lang?.englishName ?? input.targetLanguageCode;

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a translator. Translate the user message into ${targetName}. Preserve tone and register. Do not add commentary or quotation marks.`,
      },
      { role: "user", content: input.text },
    ],
    temperature: 0,
  });

  const translation = completion.choices[0]?.message?.content?.trim();
  if (!translation) {
    throw new Error("openai_returned_empty_translation");
  }
  return translation;
}
```

Move the `import { LANGUAGES }` line to the top of the file alongside the other imports.

- [ ] **Step 2: Wire the route into `app.ts`**

Modify `apps/api/src/app.ts`:

```ts
// existing imports
import {
  createOpenAI,
  streamChatCompletion,
  synthesizeSpeechOpenAI,
  translateMessage,
} from "./providers/openai";
import { createMessagesRoutes } from "./routes/messages";

// inside createApp, after voice routes:
app.route(
  "/v1/messages",
  createMessagesRoutes({
    db,
    translate: (input) => translateMessage(openai, input),
  }),
);
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/api && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Run all api tests**

```bash
pnpm test
```

Expected: all pass (Plan 4 had 33; this adds 6 → 39).

- [ ] **Step 5: Commit + push to trigger deploy**

```bash
git add apps/api/src/app.ts apps/api/src/providers/openai.ts
git commit -m "feat(api): wire /v1/messages/:id/translate into app (Plan 5)"
git push
```

Watch CI + Deploy actions go green before moving on.

---

## Phase 2 — Shared package: daily quotes

### Task 4: Daily-quotes types, cycling logic, and tests

**Files:**

- Create: `packages/shared/src/daily-quotes.ts`
- Create: `packages/shared/src/daily-quotes.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Add `SupportedLang` type to languages.ts**

Modify `packages/shared/src/languages.ts` — append at the bottom:

```ts
export type SupportedLang =
  | "en"
  | "fr"
  | "de"
  | "it"
  | "es"
  | "pt"
  | "tr"
  | "sv"
  | "da"
  | "ru"
  | "ro"
  | "hu";

export const SUPPORTED_LANG_CODES: readonly SupportedLang[] = [
  "en",
  "fr",
  "de",
  "it",
  "es",
  "pt",
  "tr",
  "sv",
  "da",
  "ru",
  "ro",
  "hu",
];
```

- [ ] **Step 2: Write the failing tests**

Create `packages/shared/src/daily-quotes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DAILY_QUOTES, quoteForDay, type SupportedLang } from "./daily-quotes";
import { SUPPORTED_LANG_CODES } from "./languages";

describe("daily quotes catalog", () => {
  it("contains at least one quote", () => {
    expect(DAILY_QUOTES.length).toBeGreaterThan(0);
  });

  it("every quote has translations for every supported language", () => {
    for (const q of DAILY_QUOTES) {
      for (const lang of SUPPORTED_LANG_CODES) {
        expect(
          q.translations[lang],
          `quote ${q.id} missing translation for ${lang}`,
        ).toBeTruthy();
      }
    }
  });

  it("every quote has a non-empty original text and attribution", () => {
    for (const q of DAILY_QUOTES) {
      expect(q.original.text.trim()).not.toBe("");
      expect(q.attribution.trim()).not.toBe("");
      expect(q.original.lang.trim()).not.toBe("");
    }
  });

  it("quote IDs are unique", () => {
    const ids = DAILY_QUOTES.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("quoteForDay", () => {
  it("returns the same quote for the same date+timezone", () => {
    const date = new Date("2026-05-10T12:00:00Z");
    const a = quoteForDay(date, "Europe/Paris");
    const b = quoteForDay(date, "Europe/Paris");
    expect(a.id).toBe(b.id);
  });

  it("rolls over at midnight in the user's timezone", () => {
    // 2026-05-10 23:30 UTC = 2026-05-11 01:30 Paris (different day)
    const utc = new Date("2026-05-10T23:30:00Z");
    const a = quoteForDay(utc, "UTC"); // still May 10 UTC
    const b = quoteForDay(utc, "Europe/Paris"); // already May 11 in Paris
    // They should likely differ (unless DAILY_QUOTES.length divides 1 evenly,
    // which only happens with exactly 1 quote — guarded by the catalog test).
    if (DAILY_QUOTES.length > 1) {
      expect(a.id).not.toBe(b.id);
    }
  });

  it("is deterministic across years (cycles through the catalog)", () => {
    const a = quoteForDay(new Date("2026-05-10T12:00:00Z"), "UTC");
    const b = quoteForDay(new Date("2027-05-10T12:00:00Z"), "UTC");
    // Same day-of-year on both dates -> same quote
    expect(a.id).toBe(b.id);
  });
});
```

- [ ] **Step 3: Run tests, confirm they fail**

```bash
cd packages/shared && pnpm test daily-quotes
```

Expected: fails with `Cannot find module './daily-quotes'`.

- [ ] **Step 4: Implement types + cycling (no data yet)**

Create `packages/shared/src/daily-quotes.ts`:

```ts
import type { SupportedLang } from "./languages";

export type { SupportedLang } from "./languages";

export type DailyQuote = {
  /** Stable kebab-case id, e.g. "wittgenstein-grenzen". */
  id: string;
  /** The quote in its original language. lang may be ANY language code,
   *  including ones not in SupportedLang (e.g. "la" Latin, "iu" Inuktitut). */
  original: {
    lang: string;
    /** Display name of the original language, e.g. "German", "Latin". */
    langDisplayName: string;
    /** Flag emoji (or empty string if no clear flag). */
    flag: string;
    text: string;
  };
  /** "— Wittgenstein", "— Tao Te Ching", etc. */
  attribution: string;
  /** Pre-baked translations into all 12 supported languages. Required. */
  translations: Record<SupportedLang, string>;
};

export const DAILY_QUOTES: readonly DailyQuote[] = [
  // Populated in Task 5
];

/**
 * Compute 1-based day-of-year in the given IANA timezone.
 * Uses Intl to convert "now" to the local date, then counts days from Jan 1.
 */
export function dayOfYearInTimezone(date: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));

  const startOfYearMs = Date.UTC(year, 0, 1);
  const localMs = Date.UTC(year, month - 1, day);
  return Math.floor((localMs - startOfYearMs) / (1000 * 60 * 60 * 24)) + 1;
}

/** Returns the quote for `date` in `timezone`. Deterministic. */
export function quoteForDay(date: Date, timezone: string): DailyQuote {
  if (DAILY_QUOTES.length === 0) {
    throw new Error("DAILY_QUOTES is empty — populate the catalog");
  }
  const dayIndex =
    (dayOfYearInTimezone(date, timezone) - 1) % DAILY_QUOTES.length;
  return DAILY_QUOTES[dayIndex];
}
```

- [ ] **Step 5: Re-export from index**

Modify `packages/shared/src/index.ts`:

```ts
export { identity } from "./identity";
export * from "./languages";
export * from "./prompts";
export * from "./daily-quotes";
```

- [ ] **Step 6: Confirm tests fail differently now (catalog-empty error)**

```bash
pnpm test daily-quotes
```

Expected: "contains at least one quote" fails because catalog is empty. Other tests skip / fail predictably. This confirms the structure is right; data comes next task.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/daily-quotes.ts packages/shared/src/daily-quotes.test.ts packages/shared/src/index.ts packages/shared/src/languages.ts
git commit -m "feat(shared): daily-quotes module skeleton + cycling logic (Plan 5)"
```

---

### Task 5: Author 50 daily quotes

**Files:**

- Modify: `packages/shared/src/daily-quotes.ts` (replace empty `DAILY_QUOTES`)

- [ ] **Step 1: Author the catalog**

Replace `DAILY_QUOTES` in `packages/shared/src/daily-quotes.ts` with 50 entries. Each quote must have:

- A stable kebab-case `id`
- An `original` in any language (even non-supported ones — Latin, Sanskrit, Yoruba, Inuit, Japanese, Finnish, Mandarin, etc.)
- `attribution` plain text
- `translations` covering all 12 supported codes: `en`, `fr`, `de`, `it`, `es`, `pt`, `tr`, `sv`, `da`, `ru`, `ro`, `hu`

Authoring guidance:

- Pick quotes about language, learning, philosophy, words, communication. Avoid politically charged or culturally sensitive material.
- Mix attribution: famous philosophers, writers, anonymous proverbs, song lyrics. Don't lean too heavily on one source.
- Keep originals short — under 200 chars each. Translations roughly the same length.
- Triple-check translations for fluency in the languages you (the agent) are confident in. For languages you're less sure about, flag them in a code comment so Bruno can review.

Example shape (one entry):

```ts
{
  id: "wittgenstein-grenzen",
  original: {
    lang: "de",
    langDisplayName: "German",
    flag: "🇩🇪",
    text: "Die Grenzen meiner Sprache bedeuten die Grenzen meiner Welt.",
  },
  attribution: "Ludwig Wittgenstein",
  translations: {
    en: "The limits of my language mean the limits of my world.",
    fr: "Les limites de ma langue signifient les limites de mon monde.",
    de: "Die Grenzen meiner Sprache bedeuten die Grenzen meiner Welt.",
    it: "I limiti del mio linguaggio sono i limiti del mio mondo.",
    es: "Los límites de mi lenguaje son los límites de mi mundo.",
    pt: "Os limites da minha linguagem são os limites do meu mundo.",
    tr: "Dilimin sınırları, dünyamın sınırlarıdır.",
    sv: "Mitt språks gränser är min världs gränser.",
    da: "Grænserne for mit sprog er grænserne for min verden.",
    ru: "Границы моего языка — это границы моего мира.",
    ro: "Limitele limbajului meu sunt limitele lumii mele.",
    hu: "Nyelvem határai világom határait jelentik.",
  },
},
```

Author 49 more, varying source language and attribution.

- [ ] **Step 2: Run tests**

```bash
cd packages/shared && pnpm test daily-quotes
```

Expected: all 7 tests pass.

- [ ] **Step 3: Run typecheck across the workspace**

```bash
cd ../.. && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/daily-quotes.ts
git commit -m "feat(shared): seed 50 hand-curated daily quotes (Plan 5)"
```

---

## Phase 3 — Mobile: Home screen

### Task 6: `useTodayStats` hook + `TodayProgress` component

**Files:**

- Create: `apps/mobile/src/features/home/use-today-stats.ts`
- Create: `apps/mobile/src/features/home/today-progress.tsx`

- [ ] **Step 1: Implement `useTodayStats`**

Create `apps/mobile/src/features/home/use-today-stats.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { useProfile } from "@/src/features/auth/use-profile";

export type TodayStats = {
  secondsSpoken: number;
  goalReached: boolean;
};

function todayInTimezone(timezone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // YYYY-MM-DD
}

export function useTodayStats() {
  const { data: profile } = useProfile();
  const timezone = profile?.timezone ?? "UTC";
  const date = todayInTimezone(timezone);

  return useQuery<TodayStats>({
    queryKey: ["today-stats", profile?.user_id, date],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streak_days")
        .select("seconds_spoken, goal_reached")
        .eq("date", date)
        .maybeSingle();

      if (error) throw error;
      return {
        secondsSpoken: data?.seconds_spoken ?? 0,
        goalReached: data?.goal_reached ?? false,
      };
    },
  });
}
```

- [ ] **Step 2: Implement `TodayProgress`**

Create `apps/mobile/src/features/home/today-progress.tsx`:

```tsx
import { StyleSheet, Text, View } from "react-native";

type Props = {
  secondsSpoken: number;
  dailyGoalMinutes: number;
};

export function TodayProgress({ secondsSpoken, dailyGoalMinutes }: Props) {
  const goalSeconds = dailyGoalMinutes * 60;
  const minutes = Math.floor(secondsSpoken / 60);
  const ratio = Math.min(
    1,
    goalSeconds === 0 ? 0 : secondsSpoken / goalSeconds,
  );
  const goalHit = secondsSpoken >= goalSeconds && goalSeconds > 0;

  return (
    <View style={styles.container}>
      <Text style={[styles.caption, goalHit && styles.captionHit]}>
        {goalHit
          ? "🎯 Goal hit — keep going!"
          : `${minutes} / ${dailyGoalMinutes} min today`}
      </Text>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${ratio * 100}%` },
            goalHit && styles.barFillHit,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", marginVertical: 16 },
  caption: {
    fontSize: 14,
    color: "#374151",
    textAlign: "center",
    marginBottom: 6,
  },
  captionHit: { color: "#059669", fontWeight: "600" },
  barTrack: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 4,
  },
  barFillHit: { backgroundColor: "#10b981" },
});
```

- [ ] **Step 3: Typecheck**

```bash
cd apps/mobile && pnpm typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/features/home/use-today-stats.ts apps/mobile/src/features/home/today-progress.tsx
git commit -m "feat(mobile): useTodayStats hook + TodayProgress component (Plan 5)"
```

---

### Task 7: `QuoteCard` component with tap-to-translate

**Files:**

- Create: `apps/mobile/src/features/home/quote-card.tsx`
- Create: `apps/mobile/src/features/home/quote-card.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/src/features/home/quote-card.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { fireEvent, render } from "@testing-library/react-native";
import { QuoteCard } from "./quote-card";
import type { DailyQuote } from "@language-coach/shared";

const sampleQuote: DailyQuote = {
  id: "test-1",
  original: {
    lang: "de",
    langDisplayName: "German",
    flag: "🇩🇪",
    text: "Die Grenzen meiner Sprache.",
  },
  attribution: "Wittgenstein",
  translations: {
    en: "The limits of my language.",
    fr: "Les limites de ma langue.",
    de: "Die Grenzen meiner Sprache.",
    it: "I limiti del mio linguaggio.",
    es: "Los límites de mi lenguaje.",
    pt: "Os limites da minha linguagem.",
    tr: "Dilimin sınırları.",
    sv: "Mitt språks gränser.",
    da: "Grænserne for mit sprog.",
    ru: "Границы моего языка.",
    ro: "Limitele limbajului meu.",
    hu: "Nyelvem határai.",
  },
};

describe("QuoteCard", () => {
  it("renders the original text and attribution by default", () => {
    const { getByText, queryByText } = render(
      <QuoteCard quote={sampleQuote} nativeLang="fr" />,
    );
    expect(getByText(/Die Grenzen meiner Sprache/)).toBeTruthy();
    expect(getByText(/Wittgenstein/)).toBeTruthy();
    expect(queryByText(/Les limites de ma langue/)).toBeNull();
  });

  it("reveals the translation in the user's native lang on tap", () => {
    const { getByText, getByTestId } = render(
      <QuoteCard quote={sampleQuote} nativeLang="fr" />,
    );
    fireEvent.press(getByTestId("quote-card"));
    expect(getByText(/Les limites de ma langue/)).toBeTruthy();
  });

  it("hides translation on second tap", () => {
    const { getByTestId, queryByText } = render(
      <QuoteCard quote={sampleQuote} nativeLang="fr" />,
    );
    const card = getByTestId("quote-card");
    fireEvent.press(card);
    fireEvent.press(card);
    expect(queryByText(/Les limites de ma langue/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
cd apps/mobile && pnpm test quote-card
```

Expected: `Cannot find module './quote-card'`.

- [ ] **Step 3: Implement `QuoteCard`**

Create `apps/mobile/src/features/home/quote-card.tsx`:

```tsx
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DailyQuote, SupportedLang } from "@language-coach/shared";

type Props = {
  quote: DailyQuote;
  nativeLang: SupportedLang;
};

export function QuoteCard({ quote, nativeLang }: Props) {
  const [showTranslation, setShowTranslation] = useState(false);
  const translation = quote.translations[nativeLang];
  const showsTranslation =
    showTranslation && quote.original.lang !== nativeLang;

  return (
    <Pressable
      testID="quote-card"
      onPress={() => setShowTranslation((s) => !s)}
      style={styles.card}
    >
      <Text style={styles.original}>"{quote.original.text}"</Text>
      <Text style={styles.attribution}>
        — {quote.attribution} {quote.original.flag}
      </Text>
      {showsTranslation ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.translation}>{translation}</Text>
          <Text style={styles.hint}>▲ hide translation</Text>
        </>
      ) : quote.original.lang !== nativeLang ? (
        <Text style={styles.hint}>▽ tap for translation</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 20,
    width: "100%",
  },
  original: {
    fontSize: 18,
    fontStyle: "italic",
    color: "#111827",
    lineHeight: 26,
    marginBottom: 12,
  },
  attribution: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "right",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#d1d5db",
    marginVertical: 12,
  },
  translation: {
    fontSize: 15,
    color: "#4b5563",
    lineHeight: 22,
  },
  hint: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 12,
    textAlign: "center",
  },
});
```

- [ ] **Step 4: Run tests, confirm they pass**

```bash
pnpm test quote-card
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/home/quote-card.tsx apps/mobile/src/features/home/quote-card.test.tsx
git commit -m "feat(mobile): QuoteCard with tap-to-translate (Plan 5)"
```

---

### Task 8: Assemble the home screen

**Files:**

- Modify: `apps/mobile/app/(tabs)/home.tsx` (replace stub)

- [ ] **Step 1: Replace the home screen**

Replace contents of `apps/mobile/app/(tabs)/home.tsx`:

```tsx
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { quoteForDay, type SupportedLang } from "@language-coach/shared";
import { useProfile } from "@/src/features/auth/use-profile";
import { useTodayStats } from "@/src/features/home/use-today-stats";
import { QuoteCard } from "@/src/features/home/quote-card";
import { TodayProgress } from "@/src/features/home/today-progress";
import { supabase } from "@/src/lib/supabase";

function useCurrentStreak() {
  return useQuery<number>({
    queryKey: ["current-streak"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("current_streak");
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
}

function dateLabel(timezone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  }).format(new Date());
}

export default function HomeScreen() {
  const router = useRouter();
  const { data: profile, isLoading: loadingProfile } = useProfile();
  const { data: stats } = useTodayStats();
  const { data: streak } = useCurrentStreak();

  if (loadingProfile || !profile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  const quote = quoteForDay(new Date(), profile.timezone);
  const streakLabel =
    (streak ?? 0) > 0
      ? `🔥 ${streak}-day streak`
      : "Build your first streak today";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.greeting}>Hi {profile.display_name} 👋</Text>
      <Text style={styles.date}>{dateLabel(profile.timezone)}</Text>

      <View style={styles.spacerLg} />

      <QuoteCard
        quote={quote}
        nativeLang={profile.native_lang as SupportedLang}
      />

      <View style={styles.spacerLg} />

      <TodayProgress
        secondsSpoken={stats?.secondsSpoken ?? 0}
        dailyGoalMinutes={profile.daily_goal_minutes}
      />

      <Pressable
        style={styles.cta}
        onPress={() => router.push("/(tabs)/practice")}
      >
        <Text style={styles.ctaText}>▶ Start practicing</Text>
      </Pressable>

      <Text style={styles.streak}>{streakLabel}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: {
    padding: 24,
    paddingTop: 48,
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  greeting: { fontSize: 24, fontWeight: "700", color: "#111827" },
  date: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  spacerLg: { height: 24 },
  cta: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginTop: 8,
  },
  ctaText: { color: "#ffffff", fontSize: 18, fontWeight: "700" },
  streak: { fontSize: 14, color: "#374151", marginTop: 24 },
});
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Smoke-test on device**

Start Metro, install/launch dev build on Android, sign in, land on home. Verify:

- Greeting + date show
- Quote card renders, tap reveals translation
- Progress bar shows 0 / N min
- "Start practicing" navigates to Practice
- Streak badge reads "Build your first streak today" (or N-day streak if you have one)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(tabs)/home.tsx
git commit -m "feat(mobile): home screen with daily quote + progress + CTA (Plan 5)"
```

---

## Phase 4 — Mobile: Progress screen

### Task 9: `useProgressSummary` hook

**Files:**

- Create: `apps/mobile/src/features/progress/use-progress-summary.ts`

- [ ] **Step 1: Implement the hook**

Create `apps/mobile/src/features/progress/use-progress-summary.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";

export type ProgressDay = {
  date: string; // YYYY-MM-DD
  seconds_spoken: number;
  goal_reached: boolean;
};

export type ProgressSummary = {
  current_streak: number;
  longest_streak: number;
  total_minutes: number;
  week_minutes: number;
  total_sessions: number;
  days: ProgressDay[];
};

export function useProgressSummary() {
  return useQuery<ProgressSummary>({
    queryKey: ["progress-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_progress_summary");
      if (error) throw error;
      return data as ProgressSummary;
    },
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/progress/use-progress-summary.ts
git commit -m "feat(mobile): useProgressSummary hook (Plan 5)"
```

---

### Task 10: `Heatmap` and `StatsRow` components (with tests)

**Files:**

- Create: `apps/mobile/src/features/progress/heatmap.tsx`
- Create: `apps/mobile/src/features/progress/heatmap.test.tsx`
- Create: `apps/mobile/src/features/progress/stats-row.tsx`

- [ ] **Step 1: Write failing tests for heatmap**

Create `apps/mobile/src/features/progress/heatmap.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";
import { Heatmap } from "./heatmap";

describe("Heatmap", () => {
  it("renders 84 cells (12 weeks × 7 days)", () => {
    const { getAllByTestId } = render(
      <Heatmap days={[]} today={new Date("2026-05-10T12:00:00Z")} />,
    );
    expect(getAllByTestId(/^heatmap-cell-/).length).toBe(84);
  });

  it("marks cells as goal-hit when day matches", () => {
    const { getByTestId } = render(
      <Heatmap
        days={[{ date: "2026-05-10", seconds_spoken: 600, goal_reached: true }]}
        today={new Date("2026-05-10T12:00:00Z")}
      />,
    );
    const cell = getByTestId("heatmap-cell-2026-05-10");
    expect(cell.props.accessibilityLabel).toContain("goal hit");
  });

  it("marks cells as 'some' when day exists but goal not reached", () => {
    const { getByTestId } = render(
      <Heatmap
        days={[
          { date: "2026-05-10", seconds_spoken: 120, goal_reached: false },
        ]}
        today={new Date("2026-05-10T12:00:00Z")}
      />,
    );
    const cell = getByTestId("heatmap-cell-2026-05-10");
    expect(cell.props.accessibilityLabel).toContain("some practice");
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
pnpm test heatmap
```

Expected: `Cannot find module './heatmap'`.

- [ ] **Step 3: Implement `Heatmap`**

Create `apps/mobile/src/features/progress/heatmap.tsx`:

```tsx
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { ProgressDay } from "./use-progress-summary";

type Props = {
  days: ProgressDay[];
  today: Date;
};

const TOTAL_CELLS = 84; // 12 weeks × 7 days

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildGrid(today: Date): string[] {
  // Returns 84 ISO date strings, oldest first.
  const dates: string[] = [];
  for (let i = TOTAL_CELLS - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(isoDate(d));
  }
  return dates;
}

export function Heatmap({ days, today }: Props) {
  const dayMap = new Map<string, ProgressDay>(days.map((d) => [d.date, d]));
  const grid = buildGrid(today);

  return (
    <View style={styles.gridContainer}>
      <View style={styles.grid}>
        {grid.map((iso) => {
          const day = dayMap.get(iso);
          const intensity = day ? (day.goal_reached ? "hit" : "some") : "none";
          const label = day
            ? day.goal_reached
              ? `${iso} ${Math.floor(day.seconds_spoken / 60)} min, goal hit`
              : `${iso} ${Math.floor(day.seconds_spoken / 60)} min, some practice`
            : `${iso} no practice`;
          return (
            <Pressable
              key={iso}
              testID={`heatmap-cell-${iso}`}
              accessibilityLabel={label}
              onPress={() => Alert.alert(iso, label)}
              style={[styles.cell, styles[intensity]]}
            />
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={[styles.cell, styles.none]} />
        <Text style={styles.legendText}>none</Text>
        <View style={[styles.cell, styles.some]} />
        <Text style={styles.legendText}>some</Text>
        <View style={[styles.cell, styles.hit]} />
        <Text style={styles.legendText}>goal hit</Text>
      </View>
    </View>
  );
}

const CELL = 14;
const GAP = 3;

const styles = StyleSheet.create({
  gridContainer: { width: "100%", alignItems: "center" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 12 * (CELL + GAP),
    gap: GAP,
  },
  cell: { width: CELL, height: CELL, borderRadius: 2 },
  none: { backgroundColor: "#e5e7eb" },
  some: { backgroundColor: "#bfdbfe" },
  hit: { backgroundColor: "#1d4ed8" },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
  },
  legendText: { fontSize: 12, color: "#6b7280", marginRight: 8 },
});
```

- [ ] **Step 4: Run heatmap tests**

```bash
pnpm test heatmap
```

Expected: 3 tests pass.

- [ ] **Step 5: Implement `StatsRow`**

Create `apps/mobile/src/features/progress/stats-row.tsx`:

```tsx
import { StyleSheet, Text, View } from "react-native";

type Props = {
  weekMinutes: number;
  longestStreak: number;
  totalSessions: number;
  totalMinutes: number;
};

export function StatsRow(props: Props) {
  const rows: [string, string][] = [
    ["This week", `${props.weekMinutes} min`],
    ["Best streak", `${props.longestStreak} days`],
    ["Sessions total", `${props.totalSessions}`],
    ["Total minutes", `${props.totalMinutes}`],
  ];
  return (
    <View style={styles.container}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  label: { fontSize: 14, color: "#374151" },
  value: { fontSize: 14, fontWeight: "600", color: "#111827" },
});
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/progress/heatmap.tsx apps/mobile/src/features/progress/heatmap.test.tsx apps/mobile/src/features/progress/stats-row.tsx
git commit -m "feat(mobile): Heatmap + StatsRow components (Plan 5)"
```

---

### Task 11: Assemble the progress screen

**Files:**

- Modify: `apps/mobile/app/(tabs)/progress.tsx` (replace stub)

- [ ] **Step 1: Replace the screen**

Replace contents of `apps/mobile/app/(tabs)/progress.tsx`:

```tsx
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useProgressSummary } from "@/src/features/progress/use-progress-summary";
import { Heatmap } from "@/src/features/progress/heatmap";
import { StatsRow } from "@/src/features/progress/stats-row";

export default function ProgressScreen() {
  const { data, isLoading, error } = useProgressSummary();

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          Could not load your progress. Pull to refresh.
        </Text>
      </View>
    );
  }

  const isEmpty = data.days.length === 0;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Progress</Text>
      <View style={styles.headerRow}>
        <Text style={styles.headerStat}>
          🔥 {data.current_streak}-day streak
        </Text>
        <Text style={styles.headerStat}>⏱ {data.total_minutes} min total</Text>
      </View>

      <Text style={styles.sectionLabel}>Last 12 weeks</Text>
      <Heatmap days={data.days} today={new Date()} />

      <View style={styles.spacer} />

      <StatsRow
        weekMinutes={data.week_minutes}
        longestStreak={data.longest_streak}
        totalSessions={data.total_sessions}
        totalMinutes={data.total_minutes}
      />

      {isEmpty ? (
        <Text style={styles.emptyHint}>
          Start practicing to fill in your first day.
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  container: { padding: 24, paddingTop: 48, backgroundColor: "#ffffff" },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  headerStat: { fontSize: 14, color: "#374151" },
  sectionLabel: { fontSize: 14, color: "#6b7280", marginBottom: 12 },
  spacer: { height: 24 },
  emptyHint: {
    marginTop: 16,
    textAlign: "center",
    color: "#6b7280",
    fontSize: 14,
  },
  errorText: { color: "#b91c1c", textAlign: "center" },
});
```

- [ ] **Step 2: Typecheck + smoke-test**

```bash
pnpm typecheck
```

On device: navigate to Progress tab. Verify heatmap renders, today's cell may be empty or "some" depending on practice. Stats row shows zeros for a fresh user.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(tabs)/progress.tsx
git commit -m "feat(mobile): progress screen with heatmap + stats (Plan 5)"
```

---

## Phase 5 — Mobile: Profile screen

### Task 12: Add `@gorhom/bottom-sheet` + cross-platform `toast` helper

**Files:**

- Modify: `apps/mobile/package.json` (via `pnpm add`)
- Create: `apps/mobile/src/lib/toast.ts`

- [ ] **Step 1: Install the dependency**

```bash
cd apps/mobile
pnpm add @gorhom/bottom-sheet
```

`@gorhom/bottom-sheet` 5.x is JS-only over `react-native-reanimated` and `react-native-gesture-handler` (both already installed via Expo Router). It should NOT require a fresh dev build. Verify by checking the install output for native module warnings.

- [ ] **Step 2: Confirm gesture-handler is set up at the root**

Open `apps/mobile/app/_layout.tsx`. The root must be wrapped in `<GestureHandlerRootView style={{ flex: 1 }}>`. If it isn't, add:

```tsx
import { GestureHandlerRootView } from "react-native-gesture-handler";

// wrap the existing root return:
return (
  <GestureHandlerRootView style={{ flex: 1 }}>
    {/* existing tree */}
  </GestureHandlerRootView>
);
```

- [ ] **Step 3: Create the toast helper**

Create `apps/mobile/src/lib/toast.ts`:

```ts
import { Alert, Platform, ToastAndroid } from "react-native";

export function showToast(message: string) {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert("", message);
  }
}
```

- [ ] **Step 4: Smoke test bottom-sheet imports**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/package.json apps/mobile/src/lib/toast.ts apps/mobile/app/_layout.tsx ../../pnpm-lock.yaml
git commit -m "feat(mobile): add @gorhom/bottom-sheet + toast helper (Plan 5)"
```

(Adjust the lockfile path if pnpm-lock.yaml is at the monorepo root — `../../pnpm-lock.yaml` from `apps/mobile/`.)

---

### Task 13: `ProfileRow` + `EditNameSheet` + `EditGoalSheet`

**Files:**

- Create: `apps/mobile/src/features/profile/profile-row.tsx`
- Create: `apps/mobile/src/features/profile/edit-name-sheet.tsx`
- Create: `apps/mobile/src/features/profile/edit-goal-sheet.tsx`

- [ ] **Step 1: Implement `ProfileRow`**

Create `apps/mobile/src/features/profile/profile-row.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  label: string;
  value: string;
  onPress: () => void;
};

export function ProfileRow({ label, value, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.rightCol}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  label: { fontSize: 16, color: "#111827" },
  rightCol: { flexDirection: "row", alignItems: "center" },
  value: { fontSize: 16, color: "#6b7280", marginRight: 8 },
  chevron: { fontSize: 20, color: "#9ca3af" },
});
```

- [ ] **Step 2: Implement `EditNameSheet`**

Create `apps/mobile/src/features/profile/edit-name-sheet.tsx`:

```tsx
import { forwardRef, useState } from "react";
import {
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Pressable, StyleSheet, Text } from "react-native";

type Props = {
  initialValue: string;
  onSave: (value: string) => Promise<void>;
};

export const EditNameSheet = forwardRef<BottomSheetModal, Props>(
  function EditNameSheet({ initialValue, onSave }, ref) {
    const [value, setValue] = useState(initialValue);
    const [saving, setSaving] = useState(false);

    const trimmed = value.trim();
    const valid = trimmed.length >= 1 && trimmed.length <= 30;

    async function handleSave() {
      if (!valid) return;
      setSaving(true);
      try {
        await onSave(trimmed);
        (ref as { current: BottomSheetModal | null }).current?.dismiss();
      } finally {
        setSaving(false);
      }
    }

    return (
      <BottomSheetModal ref={ref} snapPoints={["35%"]}>
        <BottomSheetView style={styles.content}>
          <Text style={styles.title}>Display name</Text>
          <BottomSheetTextInput
            value={value}
            onChangeText={setValue}
            placeholder="Your name"
            maxLength={30}
            autoFocus
            style={styles.input}
          />
          <Pressable
            onPress={handleSave}
            disabled={!valid || saving}
            style={[styles.button, (!valid || saving) && styles.disabled]}
          >
            <Text style={styles.buttonText}>{saving ? "Saving…" : "Save"}</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  content: { padding: 24, gap: 16 },
  title: { fontSize: 18, fontWeight: "600", color: "#111827" },
  input: {
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
  },
  button: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.5 },
});
```

- [ ] **Step 3: Implement `EditGoalSheet`**

Create `apps/mobile/src/features/profile/edit-goal-sheet.tsx`:

```tsx
import { forwardRef, useState } from "react";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

type Props = {
  initialValue: number;
  onSave: (minutes: number) => Promise<void>;
};

const OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50, 60];

export const EditGoalSheet = forwardRef<BottomSheetModal, Props>(
  function EditGoalSheet({ initialValue, onSave }, ref) {
    const [value, setValue] = useState(initialValue);
    const [saving, setSaving] = useState(false);

    async function handleSave() {
      setSaving(true);
      try {
        await onSave(value);
        (ref as { current: BottomSheetModal | null }).current?.dismiss();
      } finally {
        setSaving(false);
      }
    }

    return (
      <BottomSheetModal ref={ref} snapPoints={["50%"]}>
        <BottomSheetView style={styles.content}>
          <Text style={styles.title}>Daily goal</Text>
          <ScrollView style={styles.list}>
            {OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => setValue(opt)}
                style={[styles.option, value === opt && styles.optionSelected]}
              >
                <Text
                  style={[
                    styles.optionText,
                    value === opt && styles.optionTextSelected,
                  ]}
                >
                  {opt} min
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[styles.button, saving && styles.disabled]}
          >
            <Text style={styles.buttonText}>{saving ? "Saving…" : "Save"}</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  content: { padding: 24, gap: 16, flex: 1 },
  title: { fontSize: 18, fontWeight: "600", color: "#111827" },
  list: { maxHeight: 280 },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  optionSelected: { backgroundColor: "#dbeafe" },
  optionText: { fontSize: 16, color: "#374151" },
  optionTextSelected: { color: "#1d4ed8", fontWeight: "600" },
  button: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.5 },
});
```

- [ ] **Step 4: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/profile/profile-row.tsx apps/mobile/src/features/profile/edit-name-sheet.tsx apps/mobile/src/features/profile/edit-goal-sheet.tsx
git commit -m "feat(mobile): ProfileRow + EditNameSheet + EditGoalSheet (Plan 5)"
```

---

### Task 14: `EditLanguageSheet` + `useUpdateProfile` hook (with native_lang side effect)

**Files:**

- Create: `apps/mobile/src/features/profile/edit-language-sheet.tsx`
- Create: `apps/mobile/src/features/profile/use-update-profile.ts`
- Create: `apps/mobile/src/features/profile/use-update-profile.test.ts`

- [ ] **Step 1: Implement `EditLanguageSheet`**

Create `apps/mobile/src/features/profile/edit-language-sheet.tsx`:

```tsx
import { forwardRef, useState } from "react";
import {
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Pressable, StyleSheet, Text } from "react-native";
import { LANGUAGES, type SupportedLang } from "@language-coach/shared";

type Props = {
  title: string;
  initialValue: SupportedLang;
  onSave: (lang: SupportedLang) => Promise<void>;
};

export const EditLanguageSheet = forwardRef<BottomSheetModal, Props>(
  function EditLanguageSheet({ title, initialValue, onSave }, ref) {
    const [value, setValue] = useState<SupportedLang>(initialValue);
    const [saving, setSaving] = useState(false);

    async function handleSave() {
      setSaving(true);
      try {
        await onSave(value);
        (ref as { current: BottomSheetModal | null }).current?.dismiss();
      } finally {
        setSaving(false);
      }
    }

    return (
      <BottomSheetModal ref={ref} snapPoints={["75%"]}>
        <BottomSheetView style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <BottomSheetFlatList
            data={LANGUAGES}
            keyExtractor={(l) => l.code}
            style={styles.list}
            renderItem={({ item }) => {
              const selected = item.code === value;
              return (
                <Pressable
                  onPress={() => setValue(item.code as SupportedLang)}
                  style={[styles.row, selected && styles.rowSelected]}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text
                    style={[
                      styles.rowLabel,
                      selected && styles.rowLabelSelected,
                    ]}
                  >
                    {item.englishName}
                  </Text>
                  <Text style={styles.native}>{item.nativeName}</Text>
                </Pressable>
              );
            }}
          />
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[styles.button, saving && styles.disabled]}
          >
            <Text style={styles.buttonText}>{saving ? "Saving…" : "Save"}</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  content: { padding: 24, gap: 12, flex: 1 },
  title: { fontSize: 18, fontWeight: "600", color: "#111827" },
  list: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 12,
  },
  rowSelected: { backgroundColor: "#dbeafe" },
  flag: { fontSize: 20 },
  rowLabel: { fontSize: 16, color: "#374151", flex: 1 },
  rowLabelSelected: { color: "#1d4ed8", fontWeight: "600" },
  native: { fontSize: 13, color: "#6b7280" },
  button: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.5 },
});
```

- [ ] **Step 2: Write failing tests for `useUpdateProfile`**

Create `apps/mobile/src/features/profile/use-update-profile.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useUpdateProfile } from "./use-update-profile";

vi.mock("@/src/lib/supabase", () => {
  const update = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  }));
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  return {
    supabase: {
      from: vi.fn(() => ({ update })),
      rpc,
    },
    __mocks: { update, rpc },
  };
});

import { __mocks } from "@/src/lib/supabase";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useUpdateProfile", () => {
  beforeEach(() => {
    __mocks.update.mockClear();
    __mocks.rpc.mockClear();
  });

  it("calls profiles.update for display_name", async () => {
    const { result } = renderHook(() => useUpdateProfile("user-1"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ display_name: "Bruno" });
    });
    expect(__mocks.update).toHaveBeenCalled();
    expect(__mocks.rpc).not.toHaveBeenCalled();
  });

  it("calls clear_my_translations RPC when native_lang changes", async () => {
    const { result } = renderHook(() => useUpdateProfile("user-1"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ native_lang: "es" });
    });
    expect(__mocks.update).toHaveBeenCalled();
    expect(__mocks.rpc).toHaveBeenCalledWith("clear_my_translations");
  });

  it("does NOT call clear_my_translations when only target_lang changes", async () => {
    const { result } = renderHook(() => useUpdateProfile("user-1"), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ target_lang: "it" });
    });
    expect(__mocks.update).toHaveBeenCalled();
    expect(__mocks.rpc).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run tests, confirm they fail**

```bash
pnpm test use-update-profile
```

Expected: fails to import.

- [ ] **Step 4: Implement `useUpdateProfile`**

Create `apps/mobile/src/features/profile/use-update-profile.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";

export type ProfileUpdate = Partial<{
  display_name: string;
  native_lang: string;
  target_lang: string;
  daily_goal_minutes: number;
}>;

export function useUpdateProfile(userId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (update: ProfileUpdate) => {
      const { error } = await supabase
        .from("profiles")
        .update(update)
        .eq("user_id", userId);
      if (error) throw error;

      if (update.native_lang) {
        const { error: rpcErr } = await supabase.rpc("clear_my_translations");
        if (rpcErr) throw rpcErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["today-stats"] });
      qc.invalidateQueries({ queryKey: ["progress-summary"] });
    },
  });
}
```

- [ ] **Step 5: Run tests, confirm they pass**

```bash
pnpm test use-update-profile
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/profile/edit-language-sheet.tsx apps/mobile/src/features/profile/use-update-profile.ts apps/mobile/src/features/profile/use-update-profile.test.ts
git commit -m "feat(mobile): EditLanguageSheet + useUpdateProfile with translation cache reset (Plan 5)"
```

---

### Task 15: Assemble the profile screen

**Files:**

- Modify: `apps/mobile/app/(tabs)/profile.tsx` (replace existing)

- [ ] **Step 1: Replace the screen**

Replace contents of `apps/mobile/app/(tabs)/profile.tsx`:

```tsx
import { useRef } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  BottomSheetModal,
  BottomSheetModalProvider,
} from "@gorhom/bottom-sheet";
import Constants from "expo-constants";
import { LANGUAGES, type SupportedLang } from "@language-coach/shared";
import { useProfile } from "@/src/features/auth/use-profile";
import { supabase } from "@/src/lib/supabase";
import { useUpdateProfile } from "@/src/features/profile/use-update-profile";
import { ProfileRow } from "@/src/features/profile/profile-row";
import { EditNameSheet } from "@/src/features/profile/edit-name-sheet";
import { EditGoalSheet } from "@/src/features/profile/edit-goal-sheet";
import { EditLanguageSheet } from "@/src/features/profile/edit-language-sheet";
import { showToast } from "@/src/lib/toast";

function langDisplay(code: string): string {
  const lang = LANGUAGES.find((l) => l.code === code);
  return lang ? `${lang.flag} ${lang.englishName}` : code;
}

function avatarColorFor(userId: string): string {
  const colors = [
    "#fda4af",
    "#a7f3d0",
    "#bfdbfe",
    "#fcd34d",
    "#c4b5fd",
    "#fdba74",
  ];
  let h = 0;
  for (const c of userId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return colors[h % colors.length];
}

export default function ProfileScreen() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile(profile?.user_id ?? "");
  const nameRef = useRef<BottomSheetModal>(null);
  const nativeRef = useRef<BottomSheetModal>(null);
  const targetRef = useRef<BottomSheetModal>(null);
  const goalRef = useRef<BottomSheetModal>(null);

  if (!profile) return null;

  const onSignOut = () => {
    Alert.alert("Sign out?", "You'll need to sign in again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          supabase.auth.signOut();
        },
      },
    ]);
  };

  const initial = profile.display_name?.[0]?.toUpperCase() ?? "?";
  const version = Constants.expoConfig?.version ?? "?";
  const buildNumber =
    Constants.expoConfig?.android?.versionCode ??
    Constants.expoConfig?.ios?.buildNumber ??
    "?";

  return (
    <BottomSheetModalProvider>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profile</Text>

        <View style={styles.headerCard}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: avatarColorFor(profile.user_id) },
            ]}
          >
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.displayName}>{profile.display_name}</Text>
            <Text style={styles.email}>
              {(profile as { email?: string }).email ?? ""}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.section}>
          <ProfileRow
            label="Display name"
            value={profile.display_name}
            onPress={() => nameRef.current?.present()}
          />
          <ProfileRow
            label="Native language"
            value={langDisplay(profile.native_lang)}
            onPress={() => nativeRef.current?.present()}
          />
          <ProfileRow
            label="Learning"
            value={langDisplay(profile.target_lang)}
            onPress={() => targetRef.current?.present()}
          />
          <ProfileRow
            label="Daily goal"
            value={`${profile.daily_goal_minutes} min`}
            onPress={() => goalRef.current?.present()}
          />
        </View>

        <Text style={styles.sectionLabel}>PLAN</Text>
        <View style={styles.section}>
          <ProfileRow
            label="✨ Upgrade to Pro"
            value="Coming soon"
            onPress={() => showToast("Pro launches soon — we'll let you know.")}
          />
        </View>

        <TouchableOpacity onPress={onSignOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>
          v{version} (build {buildNumber})
        </Text>

        <EditNameSheet
          ref={nameRef}
          initialValue={profile.display_name}
          onSave={async (display_name) => {
            await update.mutateAsync({ display_name });
          }}
        />
        <EditLanguageSheet
          ref={nativeRef}
          title="Native language"
          initialValue={profile.native_lang as SupportedLang}
          onSave={async (native_lang) => {
            await update.mutateAsync({ native_lang });
          }}
        />
        <EditLanguageSheet
          ref={targetRef}
          title="Learning"
          initialValue={profile.target_lang as SupportedLang}
          onSave={async (target_lang) => {
            await update.mutateAsync({ target_lang });
          }}
        />
        <EditGoalSheet
          ref={goalRef}
          initialValue={profile.daily_goal_minutes}
          onSave={async (daily_goal_minutes) => {
            await update.mutateAsync({ daily_goal_minutes });
          }}
        />
      </ScrollView>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingTop: 48,
    backgroundColor: "#f3f4f6",
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
    marginLeft: 8,
  },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 22, fontWeight: "700", color: "#111827" },
  headerText: { flex: 1 },
  displayName: { fontSize: 18, fontWeight: "600", color: "#111827" },
  email: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  sectionLabel: {
    fontSize: 12,
    color: "#6b7280",
    letterSpacing: 0.5,
    marginLeft: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  section: { backgroundColor: "#ffffff", borderRadius: 12, overflow: "hidden" },
  signOutButton: {
    backgroundColor: "#fee2e2",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
    marginHorizontal: 0,
  },
  signOutText: { color: "#b91c1c", fontSize: 16, fontWeight: "600" },
  version: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 32,
  },
});
```

- [ ] **Step 2: Add email to the profile hook if missing**

Open `apps/mobile/src/features/auth/use-profile.ts`. If the returned profile doesn't include the user's email (from `auth.users`), augment the hook to read `supabase.auth.getUser()` and merge `email` into the returned object. Otherwise the email line in the header reads as empty (acceptable fallback for v1).

- [ ] **Step 3: Typecheck + on-device smoke test**

```bash
pnpm typecheck
```

On device: open Profile, tap each row → sheet opens → change value → save → row updates. Sign out still works.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(tabs)/profile.tsx apps/mobile/src/features/auth/use-profile.ts
git commit -m "feat(mobile): editable profile screen with sheets (Plan 5)"
```

---

## Phase 6 — Mobile: Chat enhancements

### Task 16: Add tap-to-translate to `MessageBubble`

The existing `apps/mobile/src/features/practice/MessageBubble.tsx` already renders chat bubbles. We extend it in place rather than creating a parallel `ChatBubble.tsx`.

**Files:**

- Modify: `apps/mobile/src/lib/api-client.ts` (export `authHeader` + `API_BASE_URL`)
- Create: `apps/mobile/src/features/practice/api-translate.ts`
- Create: `apps/mobile/src/features/practice/use-translate-message.ts`
- Modify: `apps/mobile/src/features/practice/MessageBubble.tsx` (add tap-to-translate)

- [ ] **Step 1: Export auth helpers from api-client**

Modify `apps/mobile/src/lib/api-client.ts`:

- Change `const API_BASE_URL =` → `export const API_BASE_URL =` (line 4)
- Change `async function authHeader(): Promise<string>` → `export async function authHeader(): Promise<string>` (line 8)

- [ ] **Step 2: Implement `api-translate.ts`**

Create `apps/mobile/src/features/practice/api-translate.ts`:

```ts
import { API_BASE_URL, authHeader } from "@/src/lib/api-client";

export async function translateMessageApi(
  messageId: string,
): Promise<{ translation: string }> {
  const res = await fetch(
    `${API_BASE_URL}/v1/messages/${messageId}/translate`,
    {
      method: "POST",
      headers: { authorization: await authHeader() },
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`translate ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ translation: string }>;
}
```

- [ ] **Step 3: Implement `use-translate-message.ts`**

Create `apps/mobile/src/features/practice/use-translate-message.ts`:

```ts
import { useMutation } from "@tanstack/react-query";
import { translateMessageApi } from "./api-translate";

export function useTranslateMessage() {
  return useMutation({
    mutationFn: (messageId: string) => translateMessageApi(messageId),
  });
}
```

- [ ] **Step 4: Add tap-to-translate to `MessageBubble`**

Replace contents of `apps/mobile/src/features/practice/MessageBubble.tsx`:

```tsx
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ChatMessage } from "./types";
import { useTranslateMessage } from "./use-translate-message";

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const [translation, setTranslation] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const translate = useTranslateMessage();

  async function handlePress() {
    if (isUser) return;
    if (translation) {
      setShowing((s) => !s);
      return;
    }
    try {
      const res = await translate.mutateAsync(message.id);
      setTranslation(res.translation);
      setShowing(true);
    } catch {
      // best-effort — user can retry by tapping again
    }
  }

  const Inner = (
    <View
      style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleCoach]}
    >
      <Text style={isUser ? styles.bubbleUserText : styles.bubbleCoachText}>
        {message.text}
      </Text>
      {!isUser && showing && translation ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.translation}>{translation}</Text>
        </>
      ) : null}
      {!isUser && !showing && !translate.isPending ? (
        <Text style={styles.hint}>🌐</Text>
      ) : null}
      {translate.isPending ? (
        <ActivityIndicator size="small" color="#6b7280" style={styles.hint} />
      ) : null}
    </View>
  );

  if (isUser) return Inner;
  return <Pressable onPress={handlePress}>{Inner}</Pressable>;
}

const styles = StyleSheet.create({
  bubble: {
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
    maxWidth: "85%",
  },
  bubbleUser: {
    backgroundColor: "#dbeafe",
    alignSelf: "flex-end",
    borderTopRightRadius: 4,
  },
  bubbleCoach: {
    backgroundColor: "#f3f4f6",
    alignSelf: "flex-start",
    borderTopLeftRadius: 4,
  },
  bubbleUserText: { color: "#111827", fontSize: 16 },
  bubbleCoachText: { color: "#111827", fontSize: 16 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#9ca3af",
    marginVertical: 8,
  },
  translation: { fontSize: 14, color: "#4b5563", fontStyle: "italic" },
  hint: {
    position: "absolute",
    bottom: 4,
    right: 8,
    fontSize: 11,
    color: "#9ca3af",
  },
});
```

The `ChatMessage` type already has `id`, `role`, `text` fields per `apps/mobile/src/features/practice/types.ts`. No upstream changes needed.

- [ ] **Step 5: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/api-client.ts apps/mobile/src/features/practice/api-translate.ts apps/mobile/src/features/practice/use-translate-message.ts apps/mobile/src/features/practice/MessageBubble.tsx
git commit -m "feat(mobile): tap-to-translate on coach MessageBubble (Plan 5)"
```

---

### Task 17: `BuildTranscript` + `ShareButton`

**Files:**

- Create: `apps/mobile/src/features/practice/build-transcript.ts`
- Create: `apps/mobile/src/features/practice/build-transcript.test.ts`
- Create: `apps/mobile/src/features/practice/share-button.tsx`

- [ ] **Step 1: Write failing tests for transcript builder**

Create `apps/mobile/src/features/practice/build-transcript.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildTranscript } from "./build-transcript";

describe("buildTranscript", () => {
  it("formats a multi-turn conversation", () => {
    const out = buildTranscript({
      languageCode: "it",
      startedAt: new Date("2026-05-10T14:00:00Z"),
      durationMinutes: 6,
      messages: [
        { role: "user", text: "Buongiorno!" },
        { role: "coach", text: "Buongiorno! Come stai?" },
        { role: "user", text: "Sto bene." },
      ],
    });
    expect(out).toContain("My Language Coach — Italian practice");
    expect(out).toContain("6 min");
    expect(out).toContain("You: Buongiorno!");
    expect(out).toContain("Coach: Buongiorno! Come stai?");
    expect(out).toContain("Practice with me at mylanguagecoach.app");
  });

  it("returns a header-only transcript when there are no messages", () => {
    const out = buildTranscript({
      languageCode: "fr",
      startedAt: new Date("2026-05-10T14:00:00Z"),
      durationMinutes: 0,
      messages: [],
    });
    expect(out).toContain("French practice");
    expect(out).not.toContain("You:");
    expect(out).not.toContain("Coach:");
  });

  it("falls back to language code when name unknown", () => {
    const out = buildTranscript({
      languageCode: "xx",
      startedAt: new Date("2026-05-10T14:00:00Z"),
      durationMinutes: 1,
      messages: [{ role: "user", text: "hi" }],
    });
    expect(out).toContain("xx practice");
  });
});
```

- [ ] **Step 2: Run tests, confirm they fail**

```bash
pnpm test build-transcript
```

Expected: `Cannot find module './build-transcript'`.

- [ ] **Step 3: Implement `buildTranscript`**

Create `apps/mobile/src/features/practice/build-transcript.ts`:

```ts
import { LANGUAGES } from "@language-coach/shared";

export type TranscriptMessage = {
  role: "user" | "coach";
  text: string;
};

export type TranscriptInput = {
  languageCode: string;
  startedAt: Date;
  durationMinutes: number;
  messages: TranscriptMessage[];
};

export function buildTranscript(input: TranscriptInput): string {
  const lang = LANGUAGES.find((l) => l.code === input.languageCode);
  const langName = lang?.englishName ?? input.languageCode;
  const dateStr = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(input.startedAt);

  const lines: string[] = [
    `My Language Coach — ${langName} practice`,
    `${dateStr} · ${input.durationMinutes} min`,
    "",
  ];
  for (const m of input.messages) {
    lines.push(`${m.role === "user" ? "You" : "Coach"}: ${m.text}`);
  }
  if (input.messages.length > 0) lines.push("");
  lines.push("Practice with me at mylanguagecoach.app");
  return lines.join("\n");
}
```

- [ ] **Step 4: Run tests, confirm they pass**

```bash
pnpm test build-transcript
```

Expected: 3 tests pass.

- [ ] **Step 5: Implement `ShareButton`**

Create `apps/mobile/src/features/practice/share-button.tsx`:

```tsx
import { Pressable, Share, StyleSheet, Text } from "react-native";
import { buildTranscript, type TranscriptMessage } from "./build-transcript";

type Props = {
  languageCode: string;
  startedAt: Date;
  durationMinutes: number;
  messages: TranscriptMessage[];
};

export function ShareButton(props: Props) {
  const disabled = props.messages.length === 0;

  async function handlePress() {
    if (disabled) return;
    const transcript = buildTranscript(props);
    try {
      await Share.share({ message: transcript });
    } catch {
      // user cancelled or system error — nothing to do
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={[styles.button, disabled && styles.disabled]}
      hitSlop={10}
    >
      <Text style={styles.icon}>↗</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { padding: 8 },
  disabled: { opacity: 0.3 },
  icon: { fontSize: 20, color: "#2563eb" },
});
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/features/practice/build-transcript.ts apps/mobile/src/features/practice/build-transcript.test.ts apps/mobile/src/features/practice/share-button.tsx
git commit -m "feat(mobile): buildTranscript + ShareButton for share-conversation (Plan 5)"
```

---

### Task 18: Wire `ShareButton` into `practice.tsx` + manual on-device validation

**Files:**

- Modify: `apps/mobile/app/(tabs)/practice.tsx`

The existing screen already uses `MessageBubble`, so once Task 16 modified that component the translation tap is live. The remaining wiring is the share button in the top bar (the screen has a custom `topBar` View, not Expo Router's header — add the button there).

- [ ] **Step 1: Track conversation start time + add share button to top bar**

Modify `apps/mobile/app/(tabs)/practice.tsx`:

```tsx
// at top of imports:
import { useEffect, useRef, useState } from "react";
import { ShareButton } from "@/src/features/practice/share-button";

// inside PracticeScreen, after `const targetLang = ...`:
const [startedAt] = useState<Date>(() => new Date());
```

Then locate the existing `topBar` View (currently shows only the End button on the right). Replace its contents with a left-aligned ShareButton + the existing End button:

```tsx
<View style={styles.topBar}>
  <ShareButton
    languageCode={targetLang}
    startedAt={startedAt}
    durationMinutes={Math.floor((Date.now() - startedAt.getTime()) / 60000)}
    messages={messages.map((m) => ({ role: m.role, text: m.text }))}
  />
  <Pressable onPress={onExit} style={styles.exitButton}>
    <Text style={styles.exitText}>End</Text>
  </Pressable>
</View>
```

Update the `topBar` style to use `justifyContent: "space-between"` instead of `"flex-end"`.

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Run all mobile tests**

```bash
pnpm test
```

Expected: all green.

- [ ] **Step 4: On-device manual validation**

Connect Android device, start Metro (`pnpm dev`), launch dev build. Walk every Plan 5 surface:

1. **Home tab:**
   - Greeting + date show
   - Quote card renders, tap reveals translation, tap again hides
   - Today's progress shows current minutes vs goal
   - Start practicing → navigates to Practice
   - Streak badge shows current streak count
2. **Practice tab:**
   - Have a multi-turn conversation
   - Tap a coach bubble → translation appears below
   - Tap again → translation hides
   - Tap share icon in header → OS share sheet opens with formatted transcript
3. **Progress tab:**
   - Heatmap renders 84 cells
   - Today's cell shows correct intensity
   - Tap a cell → alert shows date + minutes
   - Stats row shows correct numbers
4. **Profile tab:**
   - Header card shows avatar + name + (email if available)
   - Tap Display name → sheet → change → saves and updates row
   - Tap Native language → sheet → pick a different lang → saves; verify cached translations cleared (open an old coach message, tap to translate, get fresh translation in new native lang)
   - Tap Learning → sheet → pick a different lang → saves; existing past conversations unchanged
   - Tap Daily goal → sheet → change → saves
   - Tap "Upgrade to Pro" → toast appears
   - Sign out works

- [ ] **Step 5: Commit + push**

```bash
git add apps/mobile/app/(tabs)/practice.tsx
git commit -m "feat(mobile): wire ShareButton into practice top bar (Plan 5)"
git push
```

Watch CI go green.

---

## Test coverage notes

The spec calls for component tests on every new UI surface. This plan covers tests where logic actually lives:

- `daily-quotes.test.ts` — catalog completeness + cycling determinism
- `messages.test.ts` — translation route's 6 paths
- `quote-card.test.tsx` — tap-to-translate state machine
- `heatmap.test.tsx` — cell count + intensity mapping
- `use-update-profile.test.ts` — translation cache reset side effect
- `build-transcript.test.ts` — formatting + edge cases

Tests **deliberately skipped** for components that are mostly StyleSheet + props pass-through with no branching:

- `today-progress.tsx` (one threshold; covered indirectly via on-device validation)
- `stats-row.tsx` (no logic)
- `profile-row.tsx` (no logic)
- `edit-name-sheet.tsx`, `edit-language-sheet.tsx`, `edit-goal-sheet.tsx` (the validation logic is one trim() check; the save handler is delegated to `useUpdateProfile` which IS tested)
- `MessageBubble.tsx` (the translation state machine mirrors `quote-card`'s, which is tested)

If a future bug exposes a gap, fill it then.

## Done criteria

- All 18 tasks committed.
- CI green on the final push.
- All Plan 5 surfaces validated on Bruno's device per Task 18 step 6.
- `docs/superpowers/specs/2026-05-10-plan-5-around-the-voice-design.md` non-goals are still respected (no vocab/topics/push, no real paywall body, no daily-quote audio).

## Open follow-ups for later plans

- Heatmap tap → popover (instead of `Alert.alert`) — Plan 7 polish.
- Avatar upload — Plan 7+.
- Email change flow — Plan 7.
- Quote catalog growth from 50 → 200 — Plan 7 task.
- Daily-quote audio (🔊) — only if user feedback asks for it.
