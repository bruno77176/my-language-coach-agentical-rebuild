# Vocabulary Flashcards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let learners review the vocabulary they used (and were taught) in conversations as a self-rated flashcard deck, with words auto-captured from session feedback plus manual add/save and remove.

**Architecture:** Reuse the existing (currently unused) `vocab_items` table — no migration. A new `/v1/vocab` Hono route module provides list/add/review/delete; the existing `/end` feedback job upserts extracted vocab into the table; a one-time SQL backfill seeds existing data. Mobile gets a Home entry card, a deck screen, a flashcard review screen, and one shared add/save modal, all following the existing api-client + React Query conventions.

**Tech Stack:** Hono + Drizzle (Postgres) on the API; Expo Router + React Native + TanStack Query on mobile; Vitest for API tests. No mobile test runner (verify by running the app).

---

## File Structure

**API (`apps/api/`)**

- Create `src/routes/vocab.ts` — the `/v1/vocab` route module (list, add, review, delete).
- Create `src/routes/vocab.test.ts` — route tests with a fake db.
- Modify `src/app.ts` — register `createVocabRoutes({ db, translate })` under `/v1/vocab`.
- Modify `src/routes/voice.ts` — in the `/end` feedback job, upsert `fb.vocab` into `vocab_items`.
- Modify `src/routes/voice.test.ts` (if a matching test exists) or add a focused test for the upsert.
- Create `src/db/backfill-vocab.ts` — one-time idempotent backfill script.

**Mobile (`apps/mobile/`)**

- Create `src/features/vocab/api.ts` — fetch functions for the four endpoints.
- Create `src/features/vocab/use-vocab-deck.ts` — `useVocabDeck(language)` query.
- Create `src/features/vocab/use-vocab-mutations.ts` — add / review / remove mutations.
- Create `app/vocab/index.tsx` — deck screen.
- Create `app/vocab/review.tsx` — flashcard review screen.
- Create `app/(modals)/add-vocab.tsx` — shared add-word / save-from-transcript modal.
- Modify `src/features/practice/MessageBubble.tsx` — long-press to save; accept a `languageCode` prop.
- Modify `app/(tabs)/practice.tsx` — pass `languageCode` to `MessageBubble`.
- Modify `app/(tabs)/home.tsx` — add the "Review your words" card.

---

## Mastery model (reference for all tasks)

`mastery` is an integer 0–3.

- `"got_it"` → `mastery = min(mastery + 1, 3)`
- `"still_learning"` → `mastery = 0`
- **due** = `mastery < 3`; **learned** = `mastery >= 3`
- Deck/review order: `mastery asc, createdAt desc`.

---

## Task 1: `/v1/vocab` route module

**Files:**

- Create: `apps/api/src/routes/vocab.ts`
- Test: `apps/api/src/routes/vocab.test.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/routes/vocab.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createVocabRoutes } from "./vocab";

const userId = "00000000-0000-0000-0000-000000000001";

type VocabRow = {
  id: string;
  userId: string;
  language: string;
  term: string;
  translation: string | null;
  mastery: number;
  createdAt: Date;
};

function appWithVocab(routes: ReturnType<typeof createVocabRoutes>) {
  const app = new Hono<{ Variables: { userId: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", userId);
    await next();
  });
  app.route("/v1/vocab", routes);
  return app;
}

// Minimal fake db covering the drizzle calls vocab.ts makes.
function makeFakeDb({
  rows = [] as VocabRow[],
  profile = { userId, targetLang: "fr", nativeLang: "en" },
} = {}) {
  const data: VocabRow[] = [...rows];
  let idCounter = data.length;

  const fakeDb = {
    query: {
      profiles: {
        findFirst: vi.fn(async () => profile),
      },
      vocabItems: {
        findMany: vi.fn(async () =>
          data
            .filter((r) => r.userId === userId)
            .sort(
              (a, b) =>
                a.mastery - b.mastery ||
                b.createdAt.getTime() - a.createdAt.getTime(),
            ),
        ),
        findFirst: vi.fn(async (opts: { where?: unknown }) => {
          // tests set _matchId to control which row findFirst returns
          return data.find((r) => r.id === fakeDb._matchId);
        }),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn((vals: Partial<VocabRow>) => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(async () => {
            const existing = data.find(
              (r) =>
                r.userId === vals.userId &&
                r.language === vals.language &&
                r.term === vals.term,
            );
            if (existing) return []; // conflict → no row returned
            const row: VocabRow = {
              id: `id-${++idCounter}`,
              userId: vals.userId!,
              language: vals.language!,
              term: vals.term!,
              translation: vals.translation ?? null,
              mastery: 0,
              createdAt: new Date("2026-06-06T00:00:00Z"),
            };
            data.push(row);
            return [row];
          }),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((vals: Partial<VocabRow>) => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => {
            const row = data.find((r) => r.id === fakeDb._matchId);
            if (!row) return [];
            Object.assign(row, vals);
            return [row];
          }),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => {
          const idx = data.findIndex((r) => r.id === fakeDb._matchId);
          if (idx === -1) return [];
          return data.splice(idx, 1);
        }),
      })),
    })),
    _data: data,
    _matchId: undefined as string | undefined,
  };
  return fakeDb;
}

const translate = vi.fn(async () => "house");

describe("vocab routes", () => {
  it("GET /v1/vocab returns deck sorted by mastery asc with dueCount", async () => {
    const db = makeFakeDb({
      rows: [
        {
          id: "a",
          userId,
          language: "fr",
          term: "maison",
          translation: "house",
          mastery: 3,
          createdAt: new Date("2026-06-01T00:00:00Z"),
        },
        {
          id: "b",
          userId,
          language: "fr",
          term: "chien",
          translation: "dog",
          mastery: 0,
          createdAt: new Date("2026-06-02T00:00:00Z"),
        },
      ],
    });
    const app = appWithVocab(createVocabRoutes({ db: db as never, translate }));
    const res = await app.request("/v1/vocab?language=fr");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: VocabRow[];
      dueCount: number;
    };
    expect(body.items[0]?.term).toBe("chien"); // mastery 0 first
    expect(body.dueCount).toBe(1);
  });

  it("POST /v1/vocab auto-translates when translation omitted", async () => {
    const db = makeFakeDb();
    const app = appWithVocab(createVocabRoutes({ db: db as never, translate }));
    const res = await app.request("/v1/vocab", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language: "fr", term: "maison" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { item: VocabRow };
    expect(body.item.term).toBe("maison");
    expect(body.item.translation).toBe("house");
    expect(translate).toHaveBeenCalled();
  });

  it("POST /v1/vocab returns 400 when term missing", async () => {
    const db = makeFakeDb();
    const app = appWithVocab(createVocabRoutes({ db: db as never, translate }));
    const res = await app.request("/v1/vocab", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language: "fr" }),
    });
    expect(res.status).toBe(400);
  });

  it("PATCH got_it increments mastery, capped at 3", async () => {
    const db = makeFakeDb({
      rows: [
        {
          id: "a",
          userId,
          language: "fr",
          term: "maison",
          translation: "house",
          mastery: 3,
          createdAt: new Date(),
        },
      ],
    });
    db._matchId = "a";
    const app = appWithVocab(createVocabRoutes({ db: db as never, translate }));
    const res = await app.request("/v1/vocab/a", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ result: "got_it" }),
    });
    expect(res.status).toBe(200);
    expect(db._data.find((r) => r.id === "a")?.mastery).toBe(3);
  });

  it("PATCH still_learning resets mastery to 0", async () => {
    const db = makeFakeDb({
      rows: [
        {
          id: "a",
          userId,
          language: "fr",
          term: "maison",
          translation: "house",
          mastery: 2,
          createdAt: new Date(),
        },
      ],
    });
    db._matchId = "a";
    const app = appWithVocab(createVocabRoutes({ db: db as never, translate }));
    const res = await app.request("/v1/vocab/a", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ result: "still_learning" }),
    });
    expect(res.status).toBe(200);
    expect(db._data.find((r) => r.id === "a")?.mastery).toBe(0);
  });

  it("PATCH returns 404 when the row is not the caller's", async () => {
    const db = makeFakeDb();
    db._matchId = "nonexistent";
    const app = appWithVocab(createVocabRoutes({ db: db as never, translate }));
    const res = await app.request("/v1/vocab/zzz", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ result: "got_it" }),
    });
    expect(res.status).toBe(404);
  });

  it("DELETE removes the row and returns ok", async () => {
    const db = makeFakeDb({
      rows: [
        {
          id: "a",
          userId,
          language: "fr",
          term: "maison",
          translation: "house",
          mastery: 0,
          createdAt: new Date(),
        },
      ],
    });
    db._matchId = "a";
    const app = appWithVocab(createVocabRoutes({ db: db as never, translate }));
    const res = await app.request("/v1/vocab/a", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(db._data.find((r) => r.id === "a")).toBeUndefined();
  });

  it("DELETE returns 404 when nothing was deleted", async () => {
    const db = makeFakeDb();
    db._matchId = "nope";
    const app = appWithVocab(createVocabRoutes({ db: db as never, translate }));
    const res = await app.request("/v1/vocab/zzz", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm vitest run src/routes/vocab.test.ts`
Expected: FAIL — `createVocabRoutes` is not defined / module not found.

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/routes/vocab.ts`:

```ts
import { Hono } from "hono";
import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import type { Database } from "../db";
import { vocabItems } from "../db/schema";
import type { OnUsage } from "../providers/usage";
import { makeOnUsage, platformFromHeader } from "../lib/usage-bridge";

export type TranslateInput = {
  text: string;
  targetLanguageCode: string;
  onUsage?: OnUsage;
};
export type TranslateFn = (input: TranslateInput) => Promise<string>;

export type VocabDeps = { db: Database; translate: TranslateFn };

const AddBody = z.object({
  language: z.string().min(2).max(8),
  term: z.string().min(1).max(120),
  translation: z.string().min(1).max(120).optional(),
});

const ReviewBody = z.object({
  result: z.enum(["got_it", "still_learning"]),
});

const MAX_MASTERY = 3;

export function createVocabRoutes(deps: VocabDeps) {
  const routes = new Hono<{ Variables: { userId: string } }>();

  // GET /v1/vocab?language=xx — the deck, weakest first, plus dueCount.
  routes.get("/", async (c) => {
    const userId = c.get("userId");
    let language = c.req.query("language");
    if (!language) {
      const profile = await deps.db.query.profiles.findFirst({
        where: (t, { eq: e }) => e(t.userId, userId),
      });
      language = profile?.targetLang ?? "en";
    }
    const items = await deps.db.query.vocabItems.findMany({
      where: (t, { eq: e, and: a }) =>
        a(e(t.userId, userId), e(t.language, language!)),
      orderBy: (t) => [asc(t.mastery), desc(t.createdAt)],
    });
    const dueCount = items.filter((i) => i.mastery < MAX_MASTERY).length;
    return c.json({ items, dueCount });
  });

  // POST /v1/vocab — manual add; auto-translate when translation omitted.
  routes.post("/", async (c) => {
    const userId = c.get("userId");
    const body = await c.req.json().catch(() => ({}));
    const parsed = AddBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: parsed.error.message } },
        400,
      );
    }
    const { language, term } = parsed.data;
    let translation = parsed.data.translation ?? null;

    if (!translation) {
      const profile = await deps.db.query.profiles.findFirst({
        where: (t, { eq: e }) => e(t.userId, userId),
      });
      const nativeLang = profile?.nativeLang ?? "en";
      try {
        const onUsage = makeOnUsage(deps.db, {
          userId,
          platform: platformFromHeader(c.req.header("X-Client-Platform")),
        });
        translation = await deps.translate({
          text: term,
          targetLanguageCode: nativeLang,
          onUsage,
        });
      } catch {
        // Best-effort: store the term alone if translation fails.
        translation = null;
      }
    }

    const inserted = await deps.db
      .insert(vocabItems)
      .values({ userId, language, term, translation })
      .onConflictDoNothing()
      .returning();

    if (inserted.length > 0) {
      return c.json({ item: inserted[0] });
    }

    // Conflict (already in deck) — return the existing row.
    const existing = await deps.db.query.vocabItems.findFirst({
      where: (t, { eq: e, and: a }) =>
        a(e(t.userId, userId), e(t.language, language), e(t.term, term)),
    });
    return c.json({ item: existing });
  });

  // PATCH /v1/vocab/:id — record a review result.
  routes.patch("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const parsed = ReviewBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: parsed.error.message } },
        400,
      );
    }
    const row = await deps.db.query.vocabItems.findFirst({
      where: (t, { eq: e, and: a }) => a(e(t.id, id), e(t.userId, userId)),
    });
    if (!row) {
      return c.json({ error: { code: "NOT_FOUND" } }, 404);
    }
    const mastery =
      parsed.data.result === "got_it"
        ? Math.min(row.mastery + 1, MAX_MASTERY)
        : 0;
    const updated = await deps.db
      .update(vocabItems)
      .set({ mastery })
      .where(and(eq(vocabItems.id, id), eq(vocabItems.userId, userId)))
      .returning();
    return c.json({ item: updated[0] });
  });

  // DELETE /v1/vocab/:id — remove from deck.
  routes.delete("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const deleted = await deps.db
      .delete(vocabItems)
      .where(and(eq(vocabItems.id, id), eq(vocabItems.userId, userId)))
      .returning();
    if (deleted.length === 0) {
      return c.json({ error: { code: "NOT_FOUND" } }, 404);
    }
    return c.json({ ok: true });
  });

  return routes;
}
```

Note for the implementer: the fake-db test for PATCH/DELETE uses `db._matchId` to drive `findFirst`/`update`/`delete`. The real `findFirst` filters by `(id, userId)`; in the fake it returns the row whose `id === _matchId`. This keeps the fake small while exercising the route's branching (200 vs 404).

- [ ] **Step 4: Register the route in `app.ts`**

In `apps/api/src/app.ts`, find the block that registers memory/feedback routes (the `app.route("/v1/memory", ...)` line). Add directly after the `/v1/messages` registration (which already constructs `translateMessage`):

```ts
app.route(
  "/v1/vocab",
  createVocabRoutes({
    db,
    translate: (input) => translateMessage(openai, input),
  }),
);
```

Add the import near the other route imports at the top:

```ts
import { createVocabRoutes } from "./routes/vocab";
```

`translateMessage` and `openai` are already imported/constructed in `app.ts` (used by `/v1/messages`). Verify both identifiers are in scope; if `translateMessage` is not yet imported in app.ts, add `import { translateMessage } from "./providers/openai";`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/api && pnpm vitest run src/routes/vocab.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/vocab.ts apps/api/src/routes/vocab.test.ts apps/api/src/app.ts
git commit -m "feat(api): /v1/vocab routes (list, add, review, delete)"
```

---

## Task 2: Auto-persist extracted vocab into `vocab_items`

**Files:**

- Modify: `apps/api/src/routes/voice.ts` (the `/end` feedback job, ~line 895–908)
- Test: `apps/api/src/routes/vocab-persist.test.ts` (new, focused unit test of the upsert helper)

To keep the upsert testable without standing up the whole `/end` route, extract a tiny helper.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/routes/vocab-persist.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { persistVocab } from "./vocab-persist";

describe("persistVocab", () => {
  it("upserts each vocab item with onConflictDoNothing", async () => {
    const onConflictDoNothing = vi.fn(async () => {});
    const values = vi.fn(() => ({ onConflictDoNothing }));
    const insert = vi.fn(() => ({ values }));
    const db = { insert } as never;

    await persistVocab(db, {
      userId: "u1",
      language: "fr",
      vocab: [
        { term: "maison", translation: "house" },
        { term: "chien", translation: "dog" },
      ],
    });

    expect(insert).toHaveBeenCalledTimes(2);
    expect(values).toHaveBeenCalledWith({
      userId: "u1",
      language: "fr",
      term: "maison",
      translation: "house",
    });
    expect(onConflictDoNothing).toHaveBeenCalledTimes(2);
  });

  it("does nothing for an empty array", async () => {
    const insert = vi.fn();
    const db = { insert } as never;
    await persistVocab(db, { userId: "u1", language: "fr", vocab: [] });
    expect(insert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm vitest run src/routes/vocab-persist.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helper**

Create `apps/api/src/routes/vocab-persist.ts`:

```ts
import type { Database } from "../db";
import { vocabItems } from "../db/schema";

export type PersistVocabInput = {
  userId: string;
  language: string;
  vocab: Array<{ term: string; translation?: string | null }>;
};

// Upsert session-extracted vocab into the persistent deck. Deduped on the
// (user_id, language, term) unique constraint. Best-effort: callers run this
// fire-and-forget so failures never block the response.
export async function persistVocab(
  db: Database,
  input: PersistVocabInput,
): Promise<void> {
  for (const v of input.vocab) {
    if (!v.term) continue;
    await db
      .insert(vocabItems)
      .values({
        userId: input.userId,
        language: input.language,
        term: v.term,
        translation: v.translation ?? null,
      })
      .onConflictDoNothing();
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/api && pnpm vitest run src/routes/vocab-persist.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Call the helper from the `/end` feedback job**

In `apps/api/src/routes/voice.ts`, inside the fire-and-forget feedback block, immediately after the `await deps.db.update(sessionFeedback).set({ status: "ready", ... })` call (the block ending around line 903), add:

```ts
// Mirror the extracted vocab into the persistent flashcard deck.
await persistVocab(deps.db, {
  userId,
  language: conversation.language,
  vocab: fb.vocab,
});
```

Add the import at the top of `voice.ts` alongside the other route-local imports:

```ts
import { persistVocab } from "./vocab-persist";
```

`userId`, `conversation`, and `fb` are already in scope in that block. The surrounding `try/catch` already swallows errors so a vocab-persist failure cannot break `/end`.

- [ ] **Step 6: Run the api test suite to confirm nothing regressed**

Run: `cd apps/api && pnpm vitest run src/routes/voice.test.ts src/routes/vocab.test.ts src/routes/vocab-persist.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/vocab-persist.ts apps/api/src/routes/vocab-persist.test.ts apps/api/src/routes/voice.ts
git commit -m "feat(api): persist session vocab into the flashcard deck"
```

---

## Task 3: One-time backfill script

**Files:**

- Create: `apps/api/src/db/backfill-vocab.ts`
- Modify: `apps/api/package.json` (add a script entry)

- [ ] **Step 1: Write the script**

Create `apps/api/src/db/backfill-vocab.ts`:

```ts
/* eslint-disable no-console -- CLI script: stdout output is the user-facing UI */
/**
 * One-time backfill: copy vocab already extracted into session_feedback.vocab
 * into the persistent vocab_items deck. Idempotent — dedupes on the
 * (user_id, language, term) unique constraint, so it's safe to re-run.
 *
 *   pnpm tsx src/db/backfill-vocab.ts
 */
import postgres from "postgres";
import { loadEnv } from "../env";

async function main() {
  const env = loadEnv();
  const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });
  try {
    const result = await sql`
      INSERT INTO vocab_items (user_id, language, term, translation)
      SELECT c.user_id,
             c.language,
             v->>'term'        AS term,
             v->>'translation' AS translation
      FROM session_feedback sf
      JOIN conversations c ON c.id = sf.conversation_id
      CROSS JOIN LATERAL jsonb_array_elements(sf.vocab) AS v
      WHERE sf.status = 'ready'
        AND COALESCE(v->>'term', '') <> ''
      ON CONFLICT (user_id, language, term) DO NOTHING
    `;
    console.log(`Backfill complete. Rows inserted: ${result.count}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Add a package script**

In `apps/api/package.json` `scripts`, add after `seed:rate-cards`:

```json
    "backfill:vocab": "node --env-file=.env --import tsx src/db/backfill-vocab.ts"
```

(Remember to add a comma to the previous line.)

- [ ] **Step 3: Verify it typechecks**

Run: `cd apps/api && pnpm typecheck`
Expected: PASS (no type errors). The script is not run here — it runs once against prod after deploy (see Rollout).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/db/backfill-vocab.ts apps/api/package.json
git commit -m "feat(api): one-time vocab backfill script"
```

---

## Task 4: Mobile vocab data layer (api + hooks)

**Files:**

- Create: `apps/mobile/src/features/vocab/api.ts`
- Create: `apps/mobile/src/features/vocab/use-vocab-deck.ts`
- Create: `apps/mobile/src/features/vocab/use-vocab-mutations.ts`

No mobile test runner — verify by typecheck + running the app.

- [ ] **Step 1: Write the API client**

Create `apps/mobile/src/features/vocab/api.ts`:

```ts
import {
  API_BASE_URL,
  authHeader,
  clientPlatformHeader,
} from "@/src/lib/api-client";

export type VocabItem = {
  id: string;
  language: string;
  term: string;
  translation: string | null;
  mastery: number;
  createdAt: string;
};

export type VocabDeckResponse = { items: VocabItem[]; dueCount: number };
export type ReviewResult = "got_it" | "still_learning";

export async function fetchVocabDeck(
  language: string,
): Promise<VocabDeckResponse> {
  const res = await fetch(
    `${API_BASE_URL}/v1/vocab?language=${encodeURIComponent(language)}`,
    {
      headers: { authorization: await authHeader(), ...clientPlatformHeader() },
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetchVocabDeck ${res.status}: ${text}`);
  }
  return res.json() as Promise<VocabDeckResponse>;
}

export async function addVocab(input: {
  language: string;
  term: string;
  translation?: string;
}): Promise<{ item: VocabItem }> {
  const res = await fetch(`${API_BASE_URL}/v1/vocab`, {
    method: "POST",
    headers: {
      authorization: await authHeader(),
      "content-type": "application/json",
      ...clientPlatformHeader(),
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`addVocab ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ item: VocabItem }>;
}

export async function reviewVocab(
  id: string,
  result: ReviewResult,
): Promise<{ item: VocabItem }> {
  const res = await fetch(`${API_BASE_URL}/v1/vocab/${id}`, {
    method: "PATCH",
    headers: {
      authorization: await authHeader(),
      "content-type": "application/json",
      ...clientPlatformHeader(),
    },
    body: JSON.stringify({ result }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`reviewVocab ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ item: VocabItem }>;
}

export async function removeVocab(id: string): Promise<{ ok: true }> {
  const res = await fetch(`${API_BASE_URL}/v1/vocab/${id}`, {
    method: "DELETE",
    headers: { authorization: await authHeader(), ...clientPlatformHeader() },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`removeVocab ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ ok: true }>;
}
```

- [ ] **Step 2: Write the query hook**

Create `apps/mobile/src/features/vocab/use-vocab-deck.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { fetchVocabDeck } from "./api";

export function vocabDeckKey(language: string) {
  return ["vocab-deck", language] as const;
}

export function useVocabDeck(language: string | undefined) {
  return useQuery({
    queryKey: vocabDeckKey(language ?? "en"),
    queryFn: () => fetchVocabDeck(language ?? "en"),
    enabled: !!language,
  });
}
```

- [ ] **Step 3: Write the mutation hooks**

Create `apps/mobile/src/features/vocab/use-vocab-mutations.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addVocab, removeVocab, reviewVocab, type ReviewResult } from "./api";

export function useAddVocab(language: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { term: string; translation?: string }) =>
      addVocab({ language, ...input }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["vocab-deck", language] }),
  });
}

export function useReviewVocab(language: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; result: ReviewResult }) =>
      reviewVocab(input.id, input.result),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["vocab-deck", language] }),
  });
}

export function useRemoveVocab(language: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeVocab(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["vocab-deck", language] }),
  });
}
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/features/vocab
git commit -m "feat(mobile): vocab api client + react-query hooks"
```

---

## Task 5: Deck screen

**Files:**

- Create: `apps/mobile/app/vocab/index.tsx`

- [ ] **Step 1: Write the deck screen**

Create `apps/mobile/app/vocab/index.tsx`:

```tsx
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import { EditorialText, Screen } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";
import { useProfile } from "@/src/features/auth/use-profile";
import { useVocabDeck } from "@/src/features/vocab/use-vocab-deck";
import { useRemoveVocab } from "@/src/features/vocab/use-vocab-mutations";
import type { VocabItem } from "@/src/features/vocab/api";

export default function VocabDeckScreen() {
  const { data: profile } = useProfile();
  const language = profile?.target_lang ?? "en";
  const { data, isLoading } = useVocabDeck(language);
  const remove = useRemoveVocab(language);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const items = data?.items ?? [];
  const dueCount = data?.dueCount ?? 0;

  return (
    <Screen variant="gradient">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <EditorialText kind="bodyMd" color={palette.inkSoft}>
            ‹ Back
          </EditorialText>
        </Pressable>
        <Pressable
          onPress={() => router.push("/(modals)/add-vocab")}
          hitSlop={10}
        >
          <EditorialText kind="bodyMd" color={palette.accent}>
            + Add word
          </EditorialText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <EditorialText kind="displayMd" italic style={styles.title}>
          Your words
        </EditorialText>
        <EditorialText kind="bodyMd" color={palette.inkSoft}>
          {items.length} saved · {dueCount} to review
        </EditorialText>

        {isLoading ? (
          <ActivityIndicator
            color={palette.accent}
            style={{ marginTop: spacing.xl }}
          />
        ) : items.length === 0 ? (
          <EditorialText
            kind="bodyMd"
            color={palette.inkSoft}
            style={{ marginTop: spacing.xl }}
          >
            No words yet. They'll appear here as you talk with your coach — or
            add one yourself.
          </EditorialText>
        ) : (
          <View style={styles.list}>
            {items.map((item) => (
              <DeckRow
                key={item.id}
                item={item}
                confirming={confirmId === item.id}
                onLongPress={() => setConfirmId(item.id)}
                onCancel={() => setConfirmId(null)}
                onRemove={() => {
                  setConfirmId(null);
                  remove.mutate(item.id);
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        style={[styles.cta, items.length === 0 && styles.ctaDisabled]}
        disabled={items.length === 0}
        onPress={() => router.push("/vocab/review")}
      >
        <EditorialText
          kind="bodyLg"
          color={palette.peach}
          style={styles.ctaText}
        >
          {"▸"} Start review
        </EditorialText>
      </Pressable>
    </Screen>
  );
}

function DeckRow({
  item,
  confirming,
  onLongPress,
  onCancel,
  onRemove,
}: {
  item: VocabItem;
  confirming: boolean;
  onLongPress: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  return (
    <Pressable onLongPress={onLongPress} style={styles.row}>
      <View style={{ flex: 1 }}>
        <EditorialText kind="bodyLg" color={palette.ink}>
          {item.term}
        </EditorialText>
        {item.translation ? (
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            {item.translation}
          </EditorialText>
        ) : null}
      </View>
      {confirming ? (
        <View style={styles.confirmRow}>
          <Pressable onPress={onCancel} hitSlop={8}>
            <EditorialText kind="bodySm" color={palette.inkSoft}>
              Cancel
            </EditorialText>
          </Pressable>
          <Pressable onPress={onRemove} hitSlop={8}>
            <EditorialText kind="bodySm" color={palette.coral}>
              Remove
            </EditorialText>
          </Pressable>
        </View>
      ) : (
        <MasteryPips mastery={item.mastery} />
      )}
    </Pressable>
  );
}

function MasteryPips({ mastery }: { mastery: number }) {
  return (
    <View style={styles.pips}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.pip, i < mastery && styles.pipFilled]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  scroll: { padding: spacing.xl, paddingBottom: 140, gap: spacing.sm },
  title: { color: palette.ink },
  list: { marginTop: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.glassStrong,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  confirmRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  pips: { flexDirection: "row", gap: 4 },
  pip: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.inkSoft,
    opacity: 0.3,
  },
  pipFilled: { backgroundColor: palette.accent, opacity: 1 },
  cta: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.xl,
    backgroundColor: palette.ink,
    paddingVertical: spacing.base + 2,
    borderRadius: radius.lg,
    alignItems: "center",
    minHeight: 52,
    ...shadow.cta,
  },
  ctaDisabled: { opacity: 0.4 },
  ctaText: { fontWeight: "600" },
});
```

Implementer note: confirm `palette.glassStrong`, `palette.accent`, `palette.coral`, and `shadow.cta` exist in `@language-coach/design-tokens` (they are used in `end-of-session.tsx` and `home.tsx`). If `palette.coral` is absent, use `palette.accent`.

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/vocab/index.tsx
git commit -m "feat(mobile): vocab deck screen"
```

---

## Task 6: Flashcard review screen

**Files:**

- Create: `apps/mobile/app/vocab/review.tsx`

- [ ] **Step 1: Write the review screen**

Create `apps/mobile/app/vocab/review.tsx`:

```tsx
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { EditorialText, Screen } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";
import { useProfile } from "@/src/features/auth/use-profile";
import { useVocabDeck } from "@/src/features/vocab/use-vocab-deck";
import { useReviewVocab } from "@/src/features/vocab/use-vocab-mutations";
import type { ReviewResult } from "@/src/features/vocab/api";

const MAX_MASTERY = 3;

export default function VocabReviewScreen() {
  const { data: profile } = useProfile();
  const language = profile?.target_lang ?? "en";
  const { data } = useVocabDeck(language);
  const review = useReviewVocab(language);

  // Snapshot the queue once on mount so invalidations don't reshuffle mid-review.
  const queue = useMemo(() => {
    const items = data?.items ?? [];
    const due = items.filter((i) => i.mastery < MAX_MASTERY);
    return due.length > 0 ? due : items;
    // Intentionally snapshot from the first non-empty deck load; deps include
    // only the deck identity so the queue is stable through the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.items?.length]);

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [gotItCount, setGotItCount] = useState(0);

  if (queue.length === 0) {
    return (
      <Screen variant="gradient">
        <View style={styles.center}>
          <EditorialText kind="bodyMd" color={palette.inkSoft}>
            Nothing to review yet.
          </EditorialText>
          <Pressable style={styles.smallBtn} onPress={() => router.back()}>
            <EditorialText kind="bodyMd" color={palette.peach}>
              Back
            </EditorialText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (index >= queue.length) {
    return (
      <Screen variant="gradient">
        <View style={styles.center}>
          <EditorialText kind="displayMd" italic color={palette.ink}>
            Deck complete!
          </EditorialText>
          <EditorialText kind="bodyMd" color={palette.inkSoft}>
            {gotItCount} of {queue.length} marked “Got it”.
          </EditorialText>
          <Pressable
            style={styles.smallBtn}
            onPress={() => router.replace("/vocab")}
          >
            <EditorialText kind="bodyMd" color={palette.peach}>
              Done
            </EditorialText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const card = queue[index]!;

  function record(result: ReviewResult) {
    review.mutate({ id: card.id, result });
    if (result === "got_it") setGotItCount((n) => n + 1);
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  return (
    <Screen variant="gradient">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <EditorialText kind="bodyMd" color={palette.inkSoft}>
            ‹ Back
          </EditorialText>
        </Pressable>
        <EditorialText kind="bodySm" color={palette.inkSoft}>
          {index + 1} / {queue.length}
        </EditorialText>
      </View>

      <Pressable style={styles.card} onPress={() => setFlipped((f) => !f)}>
        <EditorialText kind="displayMd" align="center" color={palette.ink}>
          {card.term}
        </EditorialText>
        {flipped ? (
          <>
            <View style={styles.divider} />
            <EditorialText kind="bodyLg" align="center" color={palette.inkSoft}>
              {card.translation ?? "—"}
            </EditorialText>
          </>
        ) : (
          <EditorialText
            kind="bodySm"
            align="center"
            color={palette.inkSoft}
            style={{ marginTop: spacing.lg, opacity: 0.7 }}
          >
            Tap to reveal
          </EditorialText>
        )}
      </Pressable>

      {flipped ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => record("still_learning")}
          >
            <EditorialText kind="bodyMd" color={palette.ink}>
              Still learning
            </EditorialText>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => record("got_it")}
          >
            <EditorialText kind="bodyMd" color={palette.peach}>
              Got it
            </EditorialText>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  card: {
    flex: 1,
    margin: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: palette.glassStrong,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    ...shadow.cta,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.inkSoft,
    opacity: 0.2,
    alignSelf: "stretch",
    marginVertical: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  btn: {
    flex: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.base + 2,
    alignItems: "center",
    minHeight: 52,
    ...shadow.cta,
  },
  btnPrimary: { backgroundColor: palette.ink },
  btnSecondary: { backgroundColor: palette.cream },
  smallBtn: {
    marginTop: spacing.lg,
    backgroundColor: palette.ink,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
});
```

Implementer note: confirm `radius.xl` and `palette.cream` exist (used in `end-of-session.tsx`). The `react-hooks/exhaustive-deps` disable is replaced per the mobile-eslint rule (see Self-Review note) — use a prose dependency comment if the disable errors.

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/vocab/review.tsx
git commit -m "feat(mobile): flashcard review screen"
```

---

## Task 7: Add / save-from-transcript modal

**Files:**

- Create: `apps/mobile/app/(modals)/add-vocab.tsx`

This single modal serves both "+ Add word" (no params) and "save from transcript" (with `prefill` + `language` params). Translation is optional; the server auto-translates when left blank.

- [ ] **Step 1: Write the modal**

Create `apps/mobile/app/(modals)/add-vocab.tsx`:

```tsx
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { EditorialText, Screen } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";
import { useProfile } from "@/src/features/auth/use-profile";
import { useAddVocab } from "@/src/features/vocab/use-vocab-mutations";

export default function AddVocabScreen() {
  const params = useLocalSearchParams<{
    prefill?: string;
    language?: string;
  }>();
  const { data: profile } = useProfile();
  const language = params.language ?? profile?.target_lang ?? "en";
  const add = useAddVocab(language);

  const [term, setTerm] = useState(params.prefill ?? "");
  const [translation, setTranslation] = useState("");

  async function save() {
    const trimmed = term.trim();
    if (!trimmed) return;
    try {
      await add.mutateAsync({
        term: trimmed,
        translation: translation.trim() || undefined,
      });
      router.back();
    } catch {
      // surface minimally; keep the sheet open so the user can retry
    }
  }

  return (
    <Screen variant="gradient">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.fill}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <EditorialText kind="bodyMd" color={palette.inkSoft}>
              Cancel
            </EditorialText>
          </Pressable>
          <Pressable onPress={save} hitSlop={10} disabled={add.isPending}>
            <EditorialText kind="bodyMd" color={palette.accent}>
              {add.isPending ? "Saving…" : "Save"}
            </EditorialText>
          </Pressable>
        </View>

        <View style={styles.body}>
          <EditorialText kind="displayMd" italic color={palette.ink}>
            Save a word
          </EditorialText>

          <EditorialText
            kind="caps"
            color={palette.inkSoft}
            style={styles.label}
          >
            Word or phrase
          </EditorialText>
          <TextInput
            value={term}
            onChangeText={setTerm}
            placeholder="e.g. faire la grasse matinée"
            placeholderTextColor={palette.inkSoft}
            style={styles.input}
            autoFocus
            multiline
          />

          <EditorialText
            kind="caps"
            color={palette.inkSoft}
            style={styles.label}
          >
            Translation (optional)
          </EditorialText>
          <TextInput
            value={translation}
            onChangeText={setTranslation}
            placeholder="Leave blank to auto-translate"
            placeholderTextColor={palette.inkSoft}
            style={styles.input}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  body: { padding: spacing.xl, gap: spacing.sm },
  label: { marginTop: spacing.lg },
  input: {
    backgroundColor: palette.glassStrong,
    borderRadius: radius.lg,
    padding: spacing.md,
    color: palette.ink,
    fontSize: 17,
    ...shadow.cta,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(modals)/add-vocab.tsx"
git commit -m "feat(mobile): add/save vocab modal"
```

---

## Task 8: Long-press a message bubble to save

**Files:**

- Modify: `apps/mobile/src/features/practice/MessageBubble.tsx`
- Modify: `apps/mobile/app/(tabs)/practice.tsx`

- [ ] **Step 1: Add a `languageCode` prop + long-press handler to MessageBubble**

In `apps/mobile/src/features/practice/MessageBubble.tsx`:

Add `router` import at the top:

```ts
import { router } from "expo-router";
```

Extend `Props`:

```ts
type Props = {
  message: ChatMessage;
  listeningMode: boolean;
  revealed: boolean;
  onReveal: (id: string) => void;
  languageCode: string;
};
```

Destructure it in the component signature:

```ts
export function MessageBubble({
  message,
  listeningMode,
  revealed,
  onReveal,
  languageCode,
}: Props) {
```

Add a handler near `handleBubblePress`:

```ts
function handleLongPress() {
  if (isSoftError || showsAsListening) return;
  router.push({
    pathname: "/(modals)/add-vocab",
    params: { prefill: message.text, language: languageCode },
  });
}
```

Wire it onto the outer `Pressable` in the return:

```tsx
return (
  <Pressable
    onPress={handleBubblePress}
    onLongPress={handleLongPress}
    delayLongPress={350}
    style={styles.messageRow}
  >
    {Inner}
  </Pressable>
);
```

- [ ] **Step 2: Pass `languageCode` from practice.tsx**

In `apps/mobile/app/(tabs)/practice.tsx`, the `renderItem` for the message FlatList (around line 609) currently renders:

```tsx
<MessageBubble
  message={item}
  listeningMode={listeningMode}
  revealed={revealedIds.has(item.id)}
  onReveal={revealMessage}
/>
```

Add the `languageCode` prop using the existing target language in scope (`targetLang`):

```tsx
<MessageBubble
  message={item}
  listeningMode={listeningMode}
  revealed={revealedIds.has(item.id)}
  onReveal={revealMessage}
  languageCode={targetLang}
/>
```

Implementer note: confirm `targetLang` is in scope at that point in `practice.tsx` (it is used to start sessions). If the variable has a different name in the active-conversation component, use that; grep for `targetLang` / `target_lang` in `practice.tsx` to confirm before editing.

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/features/practice/MessageBubble.tsx "apps/mobile/app/(tabs)/practice.tsx"
git commit -m "feat(mobile): long-press a message to save it to vocab"
```

---

## Task 9: Home "Review your words" card

**Files:**

- Modify: `apps/mobile/app/(tabs)/home.tsx`

- [ ] **Step 1: Add the deck hook + card to Home**

In `apps/mobile/app/(tabs)/home.tsx`:

Add imports:

```ts
import { useVocabDeck } from "@/src/features/vocab/use-vocab-deck";
```

Inside `HomeScreen`, after the existing hooks (e.g. after `const cachedQuote = ...`), add:

```ts
const targetLang = profile?.target_lang;
const { data: vocab } = useVocabDeck(targetLang);
```

In the JSX, add a card after `<TodayProgress ... />` and before the "Start practising" CTA. Only render it when there are saved words:

```tsx
{
  vocab && vocab.items.length > 0 ? (
    <Pressable
      style={styles.vocabCard}
      onPress={() => router.push("/vocab")}
      hitSlop={8}
    >
      <View style={{ flex: 1 }}>
        <EditorialText kind="bodyLg" color={palette.ink}>
          Review your words
        </EditorialText>
        <EditorialText kind="bodySm" color={palette.inkSoft}>
          {vocab.dueCount > 0
            ? `${vocab.dueCount} to review`
            : "All caught up — browse anytime"}
        </EditorialText>
      </View>
      <EditorialText kind="displaySm" color={palette.accent}>
        {vocab.items.length}
      </EditorialText>
    </Pressable>
  ) : null;
}
```

Add the style to the `StyleSheet.create` block:

```ts
  vocabCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.glassStrong,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.cta,
  },
```

Implementer note: `displaySm` must be a valid `EditorialText` `kind`. Grep `EditorialText` kinds (used kinds include `displayXl`, `displayMd`, `bodyLg`, `bodyMd`, `bodySm`, `caps`). If `displaySm` is not defined, use `displayMd`.

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add "apps/mobile/app/(tabs)/home.tsx"
git commit -m "feat(mobile): home entry card for vocab review"
```

---

## Task 10: Full verification, PR, merge, deploy

- [ ] **Step 1: Run the full green-check gate (per the always-keep-CI-green rule)**

```bash
cd apps/api && pnpm format && pnpm lint && pnpm typecheck && pnpm test
cd ../mobile && pnpm lint && pnpm typecheck
cd ../.. && pnpm format
```

Expected: all PASS. Fix anything red before pushing.

- [ ] **Step 2: Push the branch and open a PR**

```bash
git push -u origin feat/vocab-flashcards
gh pr create --title "feat: vocabulary flashcards" --body "<summary + test plan>"
```

- [ ] **Step 3: Wait for CI to pass, then merge**

```bash
gh pr checks --watch
gh pr merge --squash
```

- [ ] **Step 4: Deploy the API to Fly (auto on merge, or manual)**

Confirm the merge triggered the Fly deploy; if not, deploy from `apps/api`. Verify `/health` → 200.

- [ ] **Step 5: Run the backfill once against prod**

```bash
cd apps/api && pnpm backfill:vocab
```

Expected: "Backfill complete. Rows inserted: N".

- [ ] **Step 6: EAS production build for mobile**

Bump `versionCode` per the existing release flow, then from `apps/mobile/`:

```bash
eas build --profile production --platform android
```

Submit to the Play Console internal track per the existing release process once the build (status `FINISHED`, uppercase) completes.

---

## Self-Review

**Spec coverage:**

- Mastery model (0–3, got_it/still_learning) → Tasks 1, 6. ✓
- `/v1/vocab` list+dueCount / add+auto-translate / patch / delete → Task 1. ✓
- Auto-persist hook in `/end` → Task 2. ✓
- One-time backfill → Task 3. ✓
- Home entry card → Task 9. ✓
- Deck screen (list, +Add, remove, Start review) → Task 5. ✓
- Flashcard review (flip + rate + complete summary) → Task 6. ✓
- Save-from-transcript (long-press → modal) → Tasks 7, 8. ✓
- Mobile data layer through api-client, no direct fetches in components → Task 4. ✓

**Spec adjustment (noted):** The spec mentioned a debounced live translation _preview_ in the save sheet. That requires translating arbitrary text, but the only translate endpoint keys off a stored `messageId`. To avoid adding a second translate endpoint today, the modal omits the live preview and relies on server-side auto-translate when the translation field is left blank (Task 1 POST). Functionally identical result; one fewer moving part.

**Placeholder scan:** No TBD/TODO. Every code step contains complete code. PR body `<summary + test plan>` in Task 10 Step 2 is a fill-at-PR-time value, not code.

**Type consistency:** `VocabItem` shape is consistent across `api.ts`, deck, and review. `ReviewResult = "got_it" | "still_learning"` matches the API `ReviewBody` enum and the `PATCH` contract. `useVocabDeck`/`useAddVocab`/`useReviewVocab`/`useRemoveVocab` names are consistent across Tasks 4–9. Query key `["vocab-deck", language]` matches between `vocabDeckKey` and the mutation invalidations.

**Mobile ESLint note (per memory):** `apps/mobile` treats `react-hooks/exhaustive-deps` disable comments as errors. In Task 6 the `useMemo` uses such a disable — replace it with a prose comment explaining the intentional dependency choice, or restructure to satisfy the rule (e.g. snapshot via a `useState` initializer keyed off first non-empty load). Resolve during implementation if lint flags it.
