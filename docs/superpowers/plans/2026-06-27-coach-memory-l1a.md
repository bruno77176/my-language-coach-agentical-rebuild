# Coach Memory L1a — Data & Extraction Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the data + library foundation for agentic coach memory — the migration, Drizzle schema, shared types, embeddings client, candidate extraction, and consolidation logic — all unit-tested, with no behaviour change to live sessions yet.

**Architecture:** Adds a curated semantic memory layer alongside the existing structured `coach_memory` profile: a `memory_items` table (pgvector embeddings + salience + SR fields), a `digest_jobs` durable queue, and a `next_plan` column on `coach_memory`. This plan delivers the pure/lib pieces; wiring into the session lifecycle is L1b.

**Tech Stack:** Hono + Drizzle ORM over Supabase Postgres (pgvector), ESM run via `tsx`, Vitest, OpenAI SDK (`text-embedding-3-small`, `gpt-4o-mini`), Zod (shared schemas).

## Global Constraints

- Package manager: `pnpm@9`, Node ≥ 20. Run commands from `app/`.
- Migrations are **hand-written numbered SQL** in `apps/api/src/db/migrations/`, applied with `pnpm -F @language-coach/api db:migrate` — **NOT** `drizzle-kit migrate`. Next number is **0022**.
- RLS UPDATE policies need **both** `USING` and `WITH CHECK`. Mirror the 4-policy pattern in `0010_coach_memory.sql` exactly.
- Tests are Vitest, co-located as `*.test.ts`. Unit tests run anywhere; integration tests (needing Postgres) are CI-only — keep this plan's tests **unit-level** (mock the DB/OpenAI client).
- Keep CI green: `pnpm format && pnpm lint && pnpm typecheck && pnpm test` from `app/` before every push. Work on a feature branch.
- Embeddings model = `text-embedding-3-small` (1536-d), but keep the model string a parameter (per "never marry one model").
- Free-tier behaviour must be unchanged by this plan (no live wiring here).
- Shared types live in `packages/shared/src/`; the existing memory schema is `packages/shared/src/coach-memory-schema.ts` (exported via `@language-coach/shared`).

---

### Task 1: Migration 0022 — pgvector, `memory_items`, `digest_jobs`, `coach_memory.next_plan`

**Files:**

- Create: `apps/api/src/db/migrations/0022_coach_memory_agentic.sql`

**Interfaces:**

- Produces: tables `memory_items`, `digest_jobs`; columns `coach_memory.next_plan jsonb`, `coach_memory.next_plan_generated_at timestamptz`. Consumed by Tasks 2, 7–10.

- [ ] **Step 1: Write the migration SQL**

```sql
-- 0022_coach_memory_agentic.sql
-- Agentic coach memory L1: semantic memory items + durable digest queue.

CREATE EXTENSION IF NOT EXISTS vector;

-- Curated, embedded memory units (one row per atomic fact/mistake/etc.).
CREATE TABLE memory_items (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  language_code        text NOT NULL,
  type                 text NOT NULL CHECK (type IN ('fact','mistake','preference','goal','persona_detail')),
  content              text NOT NULL,
  embedding            vector(1536),
  salience             real NOT NULL DEFAULT 0.5,
  status               text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  source_conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  due_at               timestamptz,
  sr_interval_days     integer,
  sr_ease              real,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  last_seen_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX memory_items_owner_idx ON memory_items (user_id, language_code, status);
CREATE INDEX memory_items_due_idx   ON memory_items (user_id, language_code, due_at);
CREATE INDEX memory_items_embedding_idx ON memory_items
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE memory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memory_items_select_own" ON memory_items
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "memory_items_insert_own" ON memory_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "memory_items_update_own" ON memory_items
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "memory_items_delete_own" ON memory_items
  FOR DELETE USING (auth.uid() = user_id);

-- Durable between-session digest queue.
CREATE TABLE digest_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
  language_code   text NOT NULL,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed')),
  attempts        integer NOT NULL DEFAULT 0,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX digest_jobs_pending_idx ON digest_jobs (status, created_at);

ALTER TABLE digest_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "digest_jobs_select_own" ON digest_jobs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "digest_jobs_insert_own" ON digest_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "digest_jobs_update_own" ON digest_jobs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "digest_jobs_delete_own" ON digest_jobs
  FOR DELETE USING (auth.uid() = user_id);

-- Next-lesson plan (the "brain" output) lives on the existing profile row.
ALTER TABLE coach_memory ADD COLUMN next_plan jsonb;
ALTER TABLE coach_memory ADD COLUMN next_plan_generated_at timestamptz;
```

> Note: `conversations` PK column is `id` (confirm with `apps/api/src/db/schema/conversations.ts` before running). If it differs, adjust the two FK references.

- [ ] **Step 2: Apply and verify the migration**

Run: `pnpm -F @language-coach/api db:migrate` then `pnpm -F @language-coach/api db:verify`
Expected: migration `0022` applied; `db:verify` shows `memory_items`, `digest_jobs`, and the new `coach_memory` columns; no errors. (Requires full prod-style env per the repo's `loadEnv()`.)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/db/migrations/0022_coach_memory_agentic.sql
git commit -m "feat(api): migration 0022 — pgvector memory_items + digest_jobs + next_plan"
```

---

### Task 2: Drizzle schema for `memory_items` and `digest_jobs` (+ `coach_memory.next_plan`)

**Files:**

- Create: `apps/api/src/db/schema/memory-items.ts`
- Create: `apps/api/src/db/schema/digest-jobs.ts`
- Modify: `apps/api/src/db/schema/coach-memory.ts` (add `nextPlan`, `nextPlanGeneratedAt`)
- Modify: `apps/api/src/db/schema/index.ts` (export the two new modules)
- Test: `apps/api/src/db/schema/memory-items.test.ts`

**Interfaces:**

- Produces: `memoryItems`, `digestJobs` Drizzle tables; types `MemoryItemRow`/`NewMemoryItemRow`, `DigestJobRow`/`NewDigestJobRow`. The `embedding` column is a `customType` mapping DB `vector(1536)` ↔ TS `number[] | null`. Consumed by Tasks 7–10.

- [ ] **Step 1: Write the failing schema test**

```ts
// apps/api/src/db/schema/memory-items.test.ts
import { describe, it, expect } from "vitest";
import { memoryItems } from "./memory-items";
import { digestJobs } from "./digest-jobs";

describe("agentic memory schema", () => {
  it("exposes memory_items columns", () => {
    const cols = Object.keys(memoryItems);
    for (const c of [
      "id",
      "userId",
      "languageCode",
      "type",
      "content",
      "embedding",
      "salience",
      "status",
      "dueAt",
    ]) {
      expect(cols).toContain(c);
    }
  });
  it("exposes digest_jobs columns", () => {
    const cols = Object.keys(digestJobs);
    for (const c of ["id", "userId", "conversationId", "status", "attempts"]) {
      expect(cols).toContain(c);
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm -F @language-coach/api test -- memory-items`
Expected: FAIL — cannot find `./memory-items`.

- [ ] **Step 3: Implement the schema (custom `vector` type)**

```ts
// apps/api/src/db/schema/memory-items.ts
import {
  customType,
  pgTable,
  uuid,
  text,
  real,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { conversations } from "./conversations";

// DB vector(1536) <-> TS number[]. pgvector wants a "[1,2,3]" text literal.
export const vector1536 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[|\]$/g, "")
      .split(",")
      .filter(Boolean)
      .map(Number);
  },
});

export const memoryItems = pgTable("memory_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.userId, { onDelete: "cascade" }),
  languageCode: text("language_code").notNull(),
  type: text("type").notNull(), // fact|mistake|preference|goal|persona_detail
  content: text("content").notNull(),
  embedding: vector1536("embedding"),
  salience: real("salience").notNull().default(0.5),
  status: text("status").notNull().default("active"), // active|archived
  sourceConversationId: uuid("source_conversation_id").references(
    () => conversations.id,
    { onDelete: "set null" },
  ),
  dueAt: timestamp("due_at", { withTimezone: true }),
  srIntervalDays: integer("sr_interval_days"),
  srEase: real("sr_ease"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type MemoryItemRow = typeof memoryItems.$inferSelect;
export type NewMemoryItemRow = typeof memoryItems.$inferInsert;
```

```ts
// apps/api/src/db/schema/digest-jobs.ts
import { pgTable, uuid, text, integer, timestamp } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { conversations } from "./conversations";

export const digestJobs = pgTable("digest_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.userId, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id")
    .notNull()
    .unique()
    .references(() => conversations.id, { onDelete: "cascade" }),
  languageCode: text("language_code").notNull(),
  status: text("status").notNull().default("pending"), // pending|running|done|failed
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type DigestJobRow = typeof digestJobs.$inferSelect;
export type NewDigestJobRow = typeof digestJobs.$inferInsert;
```

Add to `coach-memory.ts` inside the `pgTable` column object:

```ts
  nextPlan: jsonb("next_plan"),
  nextPlanGeneratedAt: timestamp("next_plan_generated_at", { withTimezone: true }),
```

Export the two new modules from `apps/api/src/db/schema/index.ts` (mirror the existing `export * from "./<name>";` lines).

- [ ] **Step 4: Run tests + typecheck to verify pass**

Run: `pnpm -F @language-coach/api test -- memory-items && pnpm -F @language-coach/api typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/schema/memory-items.ts apps/api/src/db/schema/digest-jobs.ts apps/api/src/db/schema/coach-memory.ts apps/api/src/db/schema/index.ts apps/api/src/db/schema/memory-items.test.ts
git commit -m "feat(api): Drizzle schema for memory_items + digest_jobs + next_plan"
```

---

### Task 3: Shared Zod schemas — `MemoryItem`, `MemoryItemType`, `LessonPlan`

**Files:**

- Create: `packages/shared/src/memory-items-schema.ts`
- Modify: `packages/shared/src/index.ts` (re-export)
- Test: `packages/shared/src/memory-items-schema.test.ts`

**Interfaces:**

- Produces: `MemoryItemTypeSchema` (`z.enum`), `MemoryItemCandidateSchema` (`{type, content, sr_seed?}`), `MemoryItemCandidateListSchema`, `LessonPlanSchema` (`{focus, target_structures[], suggested_topics[], callbacks[]}`), and inferred types `MemoryItemType`, `MemoryItemCandidate`, `LessonPlan`. Consumed by Tasks 5, 7, and L1b.

- [ ] **Step 1: Write the failing test**

```ts
// packages/shared/src/memory-items-schema.test.ts
import { describe, it, expect } from "vitest";
import {
  MemoryItemCandidateListSchema,
  LessonPlanSchema,
} from "./memory-items-schema";

describe("memory item candidate schema", () => {
  it("accepts a valid candidate list", () => {
    const out = MemoryItemCandidateListSchema.parse([
      { type: "mistake", content: "uses 'meine Niveau' (should be 'mein')" },
      { type: "persona_detail", content: "has a partner; they want children" },
    ]);
    expect(out).toHaveLength(2);
  });
  it("rejects an unknown type", () => {
    expect(() =>
      MemoryItemCandidateListSchema.parse([{ type: "nope", content: "x" }]),
    ).toThrow();
  });
  it("parses a lesson plan", () => {
    const p = LessonPlanSchema.parse({
      focus: "dative prepositions",
      target_structures: ["mit + dative"],
      suggested_topics: ["cooking"],
      callbacks: ["their trip to Berlin"],
    });
    expect(p.focus).toBe("dative prepositions");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm -F @language-coach/shared test -- memory-items-schema`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement the schemas**

```ts
// packages/shared/src/memory-items-schema.ts
import { z } from "zod";

export const MemoryItemTypeSchema = z.enum([
  "fact",
  "mistake",
  "preference",
  "goal",
  "persona_detail",
]);
export type MemoryItemType = z.infer<typeof MemoryItemTypeSchema>;

export const MemoryItemCandidateSchema = z.object({
  type: MemoryItemTypeSchema,
  content: z.string().min(1).max(500),
  // Optional spaced-repetition seed for mistakes/vocab (used in L1b/L2).
  sr_seed: z.boolean().optional(),
});
export type MemoryItemCandidate = z.infer<typeof MemoryItemCandidateSchema>;

export const MemoryItemCandidateListSchema = z
  .array(MemoryItemCandidateSchema)
  .max(20);

export const LessonPlanSchema = z.object({
  focus: z.string().min(1),
  target_structures: z.array(z.string()).default([]),
  suggested_topics: z.array(z.string()).default([]),
  callbacks: z.array(z.string()).default([]),
});
export type LessonPlan = z.infer<typeof LessonPlanSchema>;
```

Add to `packages/shared/src/index.ts`: `export * from "./memory-items-schema";`

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm -F @language-coach/shared test -- memory-items-schema`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/memory-items-schema.ts packages/shared/src/memory-items-schema.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): memory-item + lesson-plan zod schemas"
```

---

### Task 4: Embeddings client util

**Files:**

- Create: `apps/api/src/lib/embed-texts.ts`
- Test: `apps/api/src/lib/embed-texts.test.ts`

**Interfaces:**

- Consumes: an `OpenAI` instance (from `createOpenAI(env)`), `OnUsage` from `../providers/usage`.
- Produces: `embedTexts(client, texts, opts?) => Promise<(number[] | null)[]>` — same length as `texts`; a failed batch returns all `null` (graceful, never throws). `opts.model` defaults to `"text-embedding-3-small"`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/lib/embed-texts.test.ts
import { describe, it, expect, vi } from "vitest";
import { embedTexts } from "./embed-texts";

function fakeClient(vectors: number[][]) {
  return {
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: vectors.map((embedding, index) => ({ embedding, index })),
        usage: { prompt_tokens: 3, total_tokens: 3 },
      }),
    },
  } as any;
}

describe("embedTexts", () => {
  it("returns one vector per input text, in order", async () => {
    const client = fakeClient([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
    const out = await embedTexts(client, ["a", "b"]);
    expect(out).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });
  it("returns nulls (does not throw) when the API fails", async () => {
    const client = {
      embeddings: { create: vi.fn().mockRejectedValue(new Error("boom")) },
    } as any;
    const out = await embedTexts(client, ["a", "b"]);
    expect(out).toEqual([null, null]);
  });
  it("returns [] for empty input without calling the API", async () => {
    const client = fakeClient([]);
    const out = await embedTexts(client, []);
    expect(out).toEqual([]);
    expect(client.embeddings.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm -F @language-coach/api test -- embed-texts`
Expected: FAIL — cannot find `./embed-texts`.

- [ ] **Step 3: Implement**

```ts
// apps/api/src/lib/embed-texts.ts
import type OpenAI from "openai";
import type { OnUsage } from "../providers/usage";
import { reportError } from "./sentry";

export type EmbedOpts = { model?: string; onUsage?: OnUsage };

export async function embedTexts(
  client: OpenAI,
  texts: string[],
  opts: EmbedOpts = {},
): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];
  const model = opts.model ?? "text-embedding-3-small";
  try {
    const res = await client.embeddings.create({ model, input: texts });
    const ordered = [...res.data].sort((a, b) => a.index - b.index);
    if (opts.onUsage && res.usage) {
      void Promise.resolve(
        opts.onUsage({
          provider: "openai",
          operation: `embed:${model}`,
          inputTokens: res.usage.prompt_tokens,
          outputTokens: 0,
        }),
      ).catch(() => {});
    }
    return ordered.map((d) => d.embedding as number[]);
  } catch (err) {
    reportError(err, { where: "embed-texts.api" });
    return texts.map(() => null);
  }
}
```

> Confirm the `OnUsage` payload shape against `apps/api/src/providers/usage.ts` and `extract-memory.ts:91-100`; match field names exactly.

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm -F @language-coach/api test -- embed-texts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/embed-texts.ts apps/api/src/lib/embed-texts.test.ts
git commit -m "feat(api): embedTexts util (text-embedding-3-small, graceful failure)"
```

---

### Task 5: Candidate memory-item extraction

**Files:**

- Create: `apps/api/src/lib/extract-memory-items.ts`
- Test: `apps/api/src/lib/extract-memory-items.test.ts`

**Interfaces:**

- Consumes: `OpenAI` instance, `TranscriptTurn[]` (reuse the type exported from `./extract-memory`), `MemoryItemCandidateListSchema` from `@language-coach/shared`.
- Produces: `extractMemoryItems(client, input) => Promise<MemoryItemCandidate[]>` where `input = { transcript, languageCode, model?, onUsage? }`. Returns `[]` on any failure (never throws). Mirror `extract-memory.ts` structure (system prompt, `json_object`, usage reporting, `reportError`).

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/lib/extract-memory-items.test.ts
import { describe, it, expect, vi } from "vitest";
import { extractMemoryItems } from "./extract-memory-items";

function clientReturning(jsonContent: string) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: jsonContent } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      },
    },
  } as any;
}

describe("extractMemoryItems", () => {
  it("parses a validated candidate list from the model", async () => {
    const client = clientReturning(
      JSON.stringify({
        items: [
          {
            type: "mistake",
            content: "says 'meine Niveau' instead of 'mein Niveau'",
          },
          { type: "persona_detail", content: "has a partner; wants children" },
        ],
      }),
    );
    const out = await extractMemoryItems(client, {
      transcript: [{ role: "user", text: "..." }],
      languageCode: "de",
    });
    expect(out.map((i) => i.type)).toEqual(["mistake", "persona_detail"]);
  });
  it("returns [] on invalid JSON", async () => {
    const client = clientReturning("not json");
    const out = await extractMemoryItems(client, {
      transcript: [],
      languageCode: "de",
    });
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm -F @language-coach/api test -- extract-memory-items`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/api/src/lib/extract-memory-items.ts
import type OpenAI from "openai";
import {
  LANGUAGES,
  MemoryItemCandidateListSchema,
  type MemoryItemCandidate,
} from "@language-coach/shared";
import type { TranscriptTurn } from "./extract-memory";
import type { OnUsage } from "../providers/usage";
import { reportError } from "./sentry";

export type ExtractItemsInput = {
  transcript: TranscriptTurn[];
  languageCode: string;
  model?: string;
  onUsage?: OnUsage;
};

const SYSTEM_PROMPT = `You extract durable, atomic memory items about a language learner from one conversation transcript.

Output ONLY JSON: {"items":[{"type": <one of: "fact"|"mistake"|"preference"|"goal"|"persona_detail">, "content": "<one short factual sentence>"}]}

Rules:
- One discrete fact per item. Keep "content" under ~120 characters.
- "mistake": a concrete language error the learner made (what they said vs the rule).
- "persona_detail": a stable personal fact they stated (family, job, location, life events).
- "preference"/"goal": how/why they want to learn.
- "fact": anything else durable worth remembering.
- Only include things the learner actually said. Never invent. If nothing durable, return {"items":[]}.
- No markdown, no commentary — JSON object only.`;

export async function extractMemoryItems(
  client: OpenAI,
  input: ExtractItemsInput,
): Promise<MemoryItemCandidate[]> {
  const lang = LANGUAGES.find((l) => l.code === input.languageCode);
  const langName = lang?.englishName ?? input.languageCode;
  const transcriptText = input.transcript
    .map((t) => `${t.role.toUpperCase()}: ${t.text}`)
    .join("\n");
  const model = input.model ?? "gpt-4o-mini";

  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Language: ${langName}\n\nTRANSCRIPT:\n${transcriptText}\n\nReturn the items JSON:`,
        },
      ],
    });
  } catch (err) {
    reportError(err, { where: "extract-memory-items.api" });
    return [];
  }

  if (input.onUsage && completion.usage) {
    void Promise.resolve(
      input.onUsage({
        provider: "openai",
        operation: `chat:${model}`,
        inputTokens: completion.usage.prompt_tokens,
        outputTokens: completion.usage.completion_tokens,
      }),
    ).catch(() => {});
  }

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { items?: unknown };
    return MemoryItemCandidateListSchema.parse(parsed.items ?? []);
  } catch (err) {
    reportError(err, { where: "extract-memory-items.parse" });
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm -F @language-coach/api test -- extract-memory-items`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/extract-memory-items.ts apps/api/src/lib/extract-memory-items.test.ts
git commit -m "feat(api): extract atomic memory-item candidates from a transcript"
```

---

### Task 6: Consolidation logic (pure)

**Files:**

- Create: `apps/api/src/lib/consolidate-memory.ts`
- Test: `apps/api/src/lib/consolidate-memory.test.ts`

**Interfaces:**

- Produces (pure, no I/O):
  - `cosineSimilarity(a: number[], b: number[]): number`
  - `planConsolidation(candidates, existing, opts?) => ConsolidationDecision[]` where
    `candidates: { type: MemoryItemType; content: string; embedding: number[] | null }[]`,
    `existing: { id: string; type: MemoryItemType; embedding: number[] | null; salience: number }[]`,
    `opts.threshold` (default `0.86`), `opts.salienceBump` (default `0.1`).
  - `ConsolidationDecision = { kind: "insert"; candidateIndex: number } | { kind: "bump"; existingId: string; newSalience: number; candidateIndex: number }`
  - Rule: a candidate matches an existing item of the **same type** with the **highest** cosine sim ≥ threshold → `bump` (salience = min(1, existing.salience + bump)); otherwise `insert`. Candidates with `embedding: null` always `insert`.
- Consumed by the digest pipeline (Task 7, L1b).

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/lib/consolidate-memory.test.ts
import { describe, it, expect } from "vitest";
import { cosineSimilarity, planConsolidation } from "./consolidate-memory";

describe("cosineSimilarity", () => {
  it("is 1 for identical vectors and ~0 for orthogonal", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
});

describe("planConsolidation", () => {
  it("bumps salience when a same-type near-duplicate exists", () => {
    const decisions = planConsolidation(
      [{ type: "mistake", content: "x", embedding: [1, 0] }],
      [{ id: "e1", type: "mistake", embedding: [0.99, 0.01], salience: 0.5 }],
      { threshold: 0.86 },
    );
    expect(decisions).toEqual([
      { kind: "bump", existingId: "e1", newSalience: 0.6, candidateIndex: 0 },
    ]);
  });
  it("inserts when no same-type match clears the threshold", () => {
    const decisions = planConsolidation(
      [{ type: "fact", content: "x", embedding: [1, 0] }],
      [{ id: "e1", type: "mistake", embedding: [1, 0], salience: 0.5 }], // different type
    );
    expect(decisions).toEqual([{ kind: "insert", candidateIndex: 0 }]);
  });
  it("inserts candidates with no embedding", () => {
    const decisions = planConsolidation(
      [{ type: "fact", content: "x", embedding: null }],
      [{ id: "e1", type: "fact", embedding: [1, 0], salience: 0.5 }],
    );
    expect(decisions).toEqual([{ kind: "insert", candidateIndex: 0 }]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm -F @language-coach/api test -- consolidate-memory`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// apps/api/src/lib/consolidate-memory.ts
import type { MemoryItemType } from "@language-coach/shared";

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export type ConsolidationCandidate = {
  type: MemoryItemType;
  content: string;
  embedding: number[] | null;
};
export type ConsolidationExisting = {
  id: string;
  type: MemoryItemType;
  embedding: number[] | null;
  salience: number;
};
export type ConsolidationDecision =
  | { kind: "insert"; candidateIndex: number }
  | {
      kind: "bump";
      existingId: string;
      newSalience: number;
      candidateIndex: number;
    };

export function planConsolidation(
  candidates: ConsolidationCandidate[],
  existing: ConsolidationExisting[],
  opts: { threshold?: number; salienceBump?: number } = {},
): ConsolidationDecision[] {
  const threshold = opts.threshold ?? 0.86;
  const bump = opts.salienceBump ?? 0.1;
  return candidates.map((cand, candidateIndex) => {
    if (!cand.embedding) return { kind: "insert", candidateIndex };
    let best: { existing: ConsolidationExisting; sim: number } | null = null;
    for (const ex of existing) {
      if (ex.type !== cand.type || !ex.embedding) continue;
      const sim = cosineSimilarity(cand.embedding, ex.embedding);
      if (sim >= threshold && (!best || sim > best.sim))
        best = { existing: ex, sim };
    }
    if (best) {
      const newSalience = Math.min(
        1,
        Number((best.existing.salience + bump).toFixed(10)),
      );
      return {
        kind: "bump",
        existingId: best.existing.id,
        newSalience,
        candidateIndex,
      };
    }
    return { kind: "insert", candidateIndex };
  });
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `pnpm -F @language-coach/api test -- consolidate-memory`
Expected: PASS (note: `0.5 + 0.1` → assert `0.6`; the `toFixed` guards float drift).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/consolidate-memory.ts apps/api/src/lib/consolidate-memory.test.ts
git commit -m "feat(api): pure memory consolidation (cosine + insert/bump decisions)"
```

---

## End-of-plan checks

- [ ] `pnpm format && pnpm lint && pnpm typecheck && pnpm test` all green from `app/`.
- [ ] Push the feature branch; confirm CI green (the migration runs in CI's Postgres — ensure the CI Postgres image has pgvector available; if not, that's an L1b/infra follow-up flagged here).

## What L1a deliberately does NOT do (→ L1b)

- No change to the session lifecycle: extraction/embedding/consolidation are not yet called anywhere. `extract-memory.ts` still runs as today.
- No `digest_jobs` enqueue/worker, no retrieval/injection, no `/v1/memory` item management, no account-deletion cascade for `memory_items`. These are L1b, written as a second plan after this lands.
