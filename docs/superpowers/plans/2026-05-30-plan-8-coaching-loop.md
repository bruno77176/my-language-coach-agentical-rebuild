# Plan 8 — The Coaching Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a freemium-gated coaching loop on top of the existing voice loop: cross-session memory that makes the coach feel like it knows you, structured end-of-session feedback (3 panels: highlights / corrections / vocab), 10 role-play scenarios, daily voice quotas, RevenueCat-backed paywall, push notifications (Day 1/2/7), and a Weekly summary screen — landing as a Play Console internal-track build.

**Architecture:** Four new Postgres tables + one extended (`coach_memory`, `session_feedback`, `push_schedule`, extended `entitlements`). Memory + feedback are gpt-4o-based extractions fire-and-forget'd at `voice.ts /sessions/:id/end`; both store structured JSON validated via Zod schemas in `packages/shared`. Role-play scenarios are a static catalog injected as a `<scenario>` block into `buildCoachSystemPrompt`. Feature-gating is a single `lib/features.ts` module that wraps entitlement lookups. The mobile app gains memory consent (onboarding) + memory editor (Profile), an end-of-session sheet, a role-play picker modal, a paywall modal, RevenueCat SDK init, and a Weekly summary screen on the Progress tab.

**Tech Stack:**

- API: Hono, Drizzle ORM, Postgres (Supabase), Vitest, Sentry, pnpm; OpenAI SDK (gpt-4o for feedback + gpt-4o-mini for memory extraction); existing `onUsage` cost-recording pipeline
- Mobile: Expo Router (SDK 54), React Native, `@gorhom/bottom-sheet`, TanStack Query, Supabase JS, `react-native-purchases` (RevenueCat), inline `StyleSheet.create({...})` per the convention (NativeWind doesn't apply in this monorepo)
- Push: Expo Push Notifications via the existing `push_tokens` table; scheduler runs as a long-lived process polling `push_schedule`
- Build / ship: EAS Build (production profile), Play Console internal track

**Reference spec:** `docs/superpowers/specs/2026-05-30-plan-8-coaching-loop-design.md`

---

## Important conventions (read first)

- **All API code is ESM TypeScript.** Imports use `.js` paths even for `.ts` source files (NodeNext resolution). Existing files demonstrate this — follow them.
- **Routes** are created via factory functions: `createXyzRoutes({ db, ...deps })` returning a `Hono` instance, mounted in `apps/api/src/app.ts` via `app.route("/v1/xyz", ...)`.
- **DB tests** mostly use stubbed `Database` objects (see `src/routes/health.test.ts`). Some integration tests use a real Postgres test DB; follow the closest existing test as a model.
- **Provider tests** mock the SDK client (see `src/providers/openai.test.ts`).
- **Fire-and-forget pattern:** never `await` cost-recording inserts or background extraction jobs that aren't on the response path. Use `void doThing().catch(captureSentry)`.
- **Mobile screens use inline `StyleSheet.create({...})`** — NativeWind classNames silently don't apply in this Expo SDK 54 + pnpm + monorepo setup. Follow `apps/mobile/app/(tabs)/practice.tsx` as the pattern.
- **No RN component tests.** `@testing-library/react-native` doesn't work with Vitest in this monorepo. Mobile changes are verified on-device by Bruno at each milestone checkpoint. Don't add mobile unit tests.
- **Commit cadence:** commit at the end of every task. Use the Co-Authored-By line.
- **All `pnpm` commands** run from `apps/api/` (or `apps/mobile/` for mobile tasks) unless noted. Migrations run via `pnpm db:migrate` (custom Node runner at `apps/api/src/db/run-migrations.ts`); NEVER use `drizzle-kit migrate` directly.
- **Migrations use plain SQL** in `apps/api/src/db/migrations/`. New migration files are numbered sequentially: this plan adds `0010_*` through `0013_*`. After writing SQL, also update the Drizzle schema file so types match.
- **RLS reminder:** `UPDATE` policies need BOTH `USING` and `WITH CHECK` clauses or updates silently affect 0 rows. Apply to every new table.

---

## File structure overview

**API (`apps/api/`) — new files:**

- `src/db/migrations/0010_coach_memory.sql`
- `src/db/migrations/0011_session_feedback.sql`
- `src/db/migrations/0012_entitlements_daily_quota.sql`
- `src/db/migrations/0013_push_schedule.sql`
- `src/db/schema/coach-memory.ts`
- `src/db/schema/session-feedback.ts`
- `src/db/schema/push-schedule.ts`
- `src/lib/features.ts` + `.test.ts`
- `src/lib/extract-memory.ts` + `.test.ts`
- `src/lib/generate-feedback.ts` + `.test.ts`
- `src/lib/push-scheduler.ts` + `.test.ts`
- `src/lib/revenuecat-webhook.ts` + `.test.ts`
- `src/jobs/push-runner.ts`
- `src/routes/feedback.ts` + `.test.ts`
- `src/routes/memory.ts` + `.test.ts`
- `src/routes/billing.ts` + `.test.ts`

**API (`apps/api/`) — modified files:**

- `src/db/schema/index.ts` — re-export new schemas
- `src/db/schema/entitlements.ts` — add `daily_voice_seconds_used`, `daily_reset_at`
- `src/lib/quota.ts` — add `canUseSecondsDaily`
- `src/routes/voice.ts` — extend `/sessions` (accept `scenario_id`), extend `/sessions/:id/end` (fire memory extraction + feedback gen), extend `/sessions/:id/turns` (inject memory + scenario into system prompt)
- `src/app.ts` — mount `/v1/memory`, `/v1/sessions/:id/feedback`, `/v1/billing/*`
- `src/env.ts` — add `OPENAI_MEMORY_MODEL`, `OPENAI_FEEDBACK_MODEL`, `REVENUECAT_WEBHOOK_SECRET`
- `src/lib/account-deletion.ts` — cascade `coach_memory`, `session_feedback`, `push_schedule` (cascading FK does it automatically, but verify in test)

**Shared (`packages/shared/`) — new files:**

- `src/coach-memory-schema.ts` — Zod schema for `CoachMemory`
- `src/feedback-schema.ts` — Zod schema for `SessionFeedback`
- `src/role-play-scenarios.ts` — catalog of 10 scenarios

**Shared (`packages/shared/`) — modified files:**

- `src/prompts.ts` — extend `buildCoachSystemPrompt` to accept optional `memory` + `scenario`
- `src/index.ts` — re-export new modules

**Mobile (`apps/mobile/`) — new files:**

- `app/(onboarding)/memory-consent.tsx`
- `app/(tabs)/profile/memory.tsx`
- `app/(modals)/end-of-session.tsx`
- `app/(modals)/role-play-picker.tsx`
- `app/(modals)/paywall.tsx`
- `app/(tabs)/progress/weekly-summary.tsx`
- `src/features/practice/role-play-data.ts` (re-exports from shared with mobile-friendly types)
- `src/features/practice/use-end-of-session.ts`
- `src/features/coach-memory/use-coach-memory.ts`
- `src/features/coach-memory/use-update-memory.ts`
- `src/features/paywall/use-purchases.ts`
- `src/features/paywall/PaywallSheet.tsx`

**Mobile (`apps/mobile/`) — modified files:**

- `app/_layout.tsx` — initialize RevenueCat SDK
- `app/(onboarding)/_layout.tsx` — add memory-consent step
- `app/(tabs)/profile.tsx` — add memory editor link
- `app/(tabs)/practice.tsx` — replace `onExit` flow with end-of-session sheet
- `app/(tabs)/progress.tsx` — add Weekly summary widget
- `src/lib/api-client.ts` — add memory, feedback, role-play, billing endpoints
- `package.json` — add `react-native-purchases`
- `app.config.ts` — bump versionCode

**Manual / external (no code, but tracked as tasks):**

- RevenueCat dashboard: create project, products (`mlc_pro_monthly`, `mlc_pro_annual`), `pro` entitlement, webhook URL
- Google Play Console: subscription products matching RevenueCat IDs, internal-track submission with screenshots + AI disclaimer + privacy update

---

# Milestone 1 — Memory MVP (Tasks 1–4)

**Goal:** coach remembers across sessions. After M1, Bruno can have a conversation, end it, start a new one, and the coach references something from the previous session.

**No new UI yet.** All M1 changes are backend + the system prompt builder. The Practice tab still works exactly as before; the difference is in what the coach says.

---

### Task 1: Coach memory — schema, migration, RLS

**Files:**

- Create: `apps/api/src/db/migrations/0010_coach_memory.sql`
- Create: `apps/api/src/db/schema/coach-memory.ts`
- Modify: `apps/api/src/db/schema/index.ts`
- Create: `apps/api/src/db/schema/coach-memory.test.ts`

- [ ] **Step 1: Write the failing schema test**

`apps/api/src/db/schema/coach-memory.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { coachMemory } from "./index";

describe("coach_memory schema", () => {
  it("exports the table with the expected columns", () => {
    const cols = Object.keys(coachMemory);
    for (const c of [
      "userId",
      "languageCode",
      "proficiencyLevel",
      "recentTopics",
      "weakAreas",
      "personalContext",
      "lastSessionSummary",
      "optedOut",
      "updatedAt",
    ]) {
      expect(cols).toContain(c);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd apps/api && pnpm test src/db/schema/coach-memory.test.ts
```

Expected: FAIL (`coachMemory` not exported).

- [ ] **Step 3: Create the Drizzle schema**

`apps/api/src/db/schema/coach-memory.ts`:

```ts
import {
  pgTable,
  uuid,
  text,
  jsonb,
  boolean,
  timestamp,
  primaryKey,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const coachMemory = pgTable(
  "coach_memory",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    languageCode: text("language_code").notNull(),
    proficiencyLevel: text("proficiency_level"),
    recentTopics: jsonb("recent_topics").notNull().default([]),
    weakAreas: jsonb("weak_areas").notNull().default([]),
    personalContext: jsonb("personal_context").notNull().default({}),
    lastSessionSummary: text("last_session_summary"),
    optedOut: boolean("opted_out").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.languageCode] }),
  }),
);

export type CoachMemoryRow = typeof coachMemory.$inferSelect;
export type NewCoachMemoryRow = typeof coachMemory.$inferInsert;
```

- [ ] **Step 4: Re-export from the schema index**

Modify `apps/api/src/db/schema/index.ts` — add `export * from "./coach-memory";` after the existing exports (alphabetical is fine but the file isn't strict about order — match its current style).

- [ ] **Step 5: Run schema test to verify it passes**

```
cd apps/api && pnpm test src/db/schema/coach-memory.test.ts
```

Expected: PASS.

- [ ] **Step 6: Write the SQL migration**

`apps/api/src/db/migrations/0010_coach_memory.sql`:

```sql
CREATE TABLE coach_memory (
  user_id              uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  language_code        text NOT NULL,
  proficiency_level    text,
  recent_topics        jsonb NOT NULL DEFAULT '[]'::jsonb,
  weak_areas           jsonb NOT NULL DEFAULT '[]'::jsonb,
  personal_context     jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_session_summary text,
  opted_out            boolean NOT NULL DEFAULT false,
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, language_code)
);

ALTER TABLE coach_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_memory_select_own" ON coach_memory
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "coach_memory_insert_own" ON coach_memory
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "coach_memory_update_own" ON coach_memory
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "coach_memory_delete_own" ON coach_memory
  FOR DELETE USING (auth.uid() = user_id);
```

- [ ] **Step 7: Run migrations against the dev DB**

```
cd apps/api && pnpm db:migrate
```

Expected: `Applied 0010_coach_memory.sql` line in output. If it errors with "already exists", you re-ran on a DB that has the table — that's fine, the runner is idempotent on the `__app_migrations` tracking table.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/db/migrations/0010_coach_memory.sql \
        apps/api/src/db/schema/coach-memory.ts \
        apps/api/src/db/schema/coach-memory.test.ts \
        apps/api/src/db/schema/index.ts
git commit -m "$(cat <<'EOF'
feat(api): coach_memory schema + RLS

Per-language structured-profile table for cross-session coach memory.
Plan 8 Milestone 1, Task 1.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: CoachMemory Zod schema in shared

**Files:**

- Create: `packages/shared/src/coach-memory-schema.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `packages/shared/src/coach-memory-schema.test.ts`

- [ ] **Step 1: Write the failing Zod schema test**

`packages/shared/src/coach-memory-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CoachMemorySchema, RecentTopicSchema } from "./coach-memory-schema";

describe("CoachMemorySchema", () => {
  it("accepts an empty memory shape", () => {
    const parsed = CoachMemorySchema.parse({
      recent_topics: [],
      weak_areas: [],
      personal_context: {},
    });
    expect(parsed.recent_topics).toEqual([]);
  });

  it("rejects unknown keys at root", () => {
    expect(() =>
      CoachMemorySchema.parse({
        recent_topics: [],
        weak_areas: [],
        personal_context: {},
        rogue: "value",
      }),
    ).toThrow();
  });

  it("caps recent_topics at 20 (extra entries dropped to last 20)", () => {
    const topics = Array.from({ length: 25 }, (_, i) => ({
      topic: `t${i}`,
      last_practiced_at: "2026-05-30T10:00:00.000Z",
    }));
    const parsed = CoachMemorySchema.parse({
      recent_topics: topics,
      weak_areas: [],
      personal_context: {},
    });
    expect(parsed.recent_topics).toHaveLength(20);
    expect(parsed.recent_topics[0]!.topic).toBe("t5"); // oldest 5 dropped
  });

  it("RecentTopicSchema requires topic + last_practiced_at", () => {
    expect(() => RecentTopicSchema.parse({ topic: "x" })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd packages/shared && pnpm test src/coach-memory-schema.test.ts
```

Expected: FAIL (module doesn't exist).

- [ ] **Step 3: Create the Zod schema**

`packages/shared/src/coach-memory-schema.ts`:

```ts
import { z } from "zod";

export const RecentTopicSchema = z.object({
  topic: z.string().min(1).max(80),
  last_practiced_at: z.string().datetime(),
});

export const PersonalContextSchema = z
  .object({
    hobbies: z.array(z.string()).max(20).optional(),
    job: z.string().max(120).optional(),
    family: z.string().max(240).optional(),
    location: z.string().max(120).optional(),
    motivations: z.array(z.string()).max(10).optional(),
  })
  .strict();

export const CoachMemorySchema = z
  .object({
    proficiency_level: z
      .enum(["A1", "A2", "B1", "B2", "C1", "C2"])
      .optional()
      .nullable(),
    recent_topics: z
      .array(RecentTopicSchema)
      .transform((arr) => arr.slice(-20)), // cap at 20 most recent
    weak_areas: z.array(z.string().min(1).max(80)).max(20),
    personal_context: PersonalContextSchema,
    last_session_summary: z.string().max(1000).optional().nullable(),
  })
  .strict();

export type CoachMemory = z.infer<typeof CoachMemorySchema>;
export type RecentTopic = z.infer<typeof RecentTopicSchema>;
export type PersonalContext = z.infer<typeof PersonalContextSchema>;

export function emptyCoachMemory(): CoachMemory {
  return {
    proficiency_level: null,
    recent_topics: [],
    weak_areas: [],
    personal_context: {},
    last_session_summary: null,
  };
}
```

- [ ] **Step 4: Re-export from shared index**

Modify `packages/shared/src/index.ts` — add `export * from "./coach-memory-schema";`.

- [ ] **Step 5: Run tests to verify they pass**

```
cd packages/shared && pnpm test src/coach-memory-schema.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/coach-memory-schema.ts \
        packages/shared/src/coach-memory-schema.test.ts \
        packages/shared/src/index.ts
git commit -m "$(cat <<'EOF'
feat(shared): CoachMemory Zod schema

Strict schema for cross-session coach memory; auto-caps recent_topics
at 20 most-recent entries. Plan 8 M1 Task 2.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Memory extraction function

**Files:**

- Create: `apps/api/src/lib/extract-memory.ts`
- Create: `apps/api/src/lib/extract-memory.test.ts`

The extractor takes the existing memory + a transcript and returns the updated memory. One gpt-4o-mini call. Validates output with Zod. Returns `null` on parse failure (caller decides whether to retry or skip).

- [ ] **Step 1: Write the failing extractor test**

`apps/api/src/lib/extract-memory.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { extractMemory } from "./extract-memory";
import { emptyCoachMemory } from "@language-coach/shared";

const okClient = {
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                proficiency_level: "B1",
                recent_topics: [
                  {
                    topic: "trip to Italy",
                    last_practiced_at: "2026-05-30T10:00:00.000Z",
                  },
                ],
                weak_areas: ["past tense irregulars"],
                personal_context: { job: "engineer" },
                last_session_summary: "Talked about an upcoming trip.",
              }),
            },
          },
        ],
        usage: { prompt_tokens: 200, completion_tokens: 80 },
      }),
    },
  },
};

describe("extractMemory", () => {
  it("returns parsed memory on a happy-path completion", async () => {
    const out = await extractMemory(okClient as any, {
      existingMemory: emptyCoachMemory(),
      transcript: [
        { role: "user", text: "I'm planning a trip to Italy" },
        { role: "coach", text: "How exciting! Where in Italy?" },
      ],
      languageCode: "it",
    });
    expect(out).not.toBeNull();
    expect(out!.proficiency_level).toBe("B1");
    expect(out!.recent_topics[0]!.topic).toBe("trip to Italy");
  });

  it("returns null when the model returns invalid JSON", async () => {
    const badClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "not json at all" } }],
            usage: { prompt_tokens: 50, completion_tokens: 10 },
          }),
        },
      },
    };
    const out = await extractMemory(badClient as any, {
      existingMemory: emptyCoachMemory(),
      transcript: [{ role: "user", text: "hi" }],
      languageCode: "it",
    });
    expect(out).toBeNull();
  });

  it("returns null when the model returns extra fields", async () => {
    const strictClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    proficiency_level: "B1",
                    recent_topics: [],
                    weak_areas: [],
                    personal_context: {},
                    last_session_summary: null,
                    rogue_field: "boom",
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 50, completion_tokens: 20 },
          }),
        },
      },
    };
    const out = await extractMemory(strictClient as any, {
      existingMemory: emptyCoachMemory(),
      transcript: [{ role: "user", text: "hi" }],
      languageCode: "it",
    });
    expect(out).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd apps/api && pnpm test src/lib/extract-memory.test.ts
```

Expected: FAIL (module doesn't exist).

- [ ] **Step 3: Implement the extractor**

`apps/api/src/lib/extract-memory.ts`:

```ts
import type OpenAI from "openai";
import {
  CoachMemorySchema,
  type CoachMemory,
  LANGUAGES,
} from "@language-coach/shared";
import type { OnUsage } from "../providers/usage";

export type TranscriptTurn = {
  role: "user" | "coach";
  text: string;
};

export type ExtractMemoryInput = {
  existingMemory: CoachMemory;
  transcript: TranscriptTurn[];
  languageCode: string;
  model?: string;
  onUsage?: OnUsage;
};

const SYSTEM_PROMPT = `You update a structured language-learner profile.

You receive:
1. The student's CURRENT memory (JSON).
2. A NEW conversation transcript between the student and their coach.

You output ONLY a JSON object that strictly matches the same schema as the current memory. Rules:
- If a field is unchanged, return its existing value.
- If a fact is unclear from the transcript, omit changes to that field.
- Cap recent_topics at 20 entries; keep the most recent.
- proficiency_level must be one of "A1","A2","B1","B2","C1","C2" or omitted.
- Never invent personal facts the student did not say.
- Output ONLY the JSON object, no commentary, no markdown fences.`;

export async function extractMemory(
  client: OpenAI,
  input: ExtractMemoryInput,
): Promise<CoachMemory | null> {
  const lang = LANGUAGES.find((l) => l.code === input.languageCode);
  const langName = lang?.englishName ?? input.languageCode;
  const transcriptText = input.transcript
    .map((t) => `${t.role.toUpperCase()}: ${t.text}`)
    .join("\n");
  const userPrompt = `Language: ${langName}

CURRENT MEMORY:
${JSON.stringify(input.existingMemory, null, 2)}

NEW TRANSCRIPT:
${transcriptText}

Return the updated memory JSON:`;

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: input.model ?? "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
  } catch {
    return null;
  }

  if (input.onUsage && completion.usage) {
    void Promise.resolve(
      input.onUsage({
        provider: "openai",
        operation: `extract-memory:${input.model ?? "gpt-4o-mini"}`,
        inputTokens: completion.usage.prompt_tokens,
        outputTokens: completion.usage.completion_tokens,
      }),
    ).catch(() => {});
  }

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const validated = CoachMemorySchema.parse(parsed);
    return validated;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```
cd apps/api && pnpm test src/lib/extract-memory.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/extract-memory.ts apps/api/src/lib/extract-memory.test.ts
git commit -m "$(cat <<'EOF'
feat(api): memory extraction with gpt-4o-mini + Zod validation

Plan 8 M1 Task 3. Returns null on parse failure (caller decides).
Cost ~$0.0002/session. Wired into voice.ts /end in Task 4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Wire memory into voice.ts (read + write paths)

**Files:**

- Modify: `packages/shared/src/prompts.ts`
- Create: `packages/shared/src/prompts.test.ts`
- Modify: `apps/api/src/routes/voice.ts`
- Modify: `apps/api/src/routes/voice.test.ts` (if it has end-handler tests)

The extension to `buildCoachSystemPrompt` accepts optional `memory` and `scenario`. The voice.ts `/turns` handler loads memory and injects it. The `/end` handler fires-and-forgets the extraction.

- [ ] **Step 1: Write the failing prompt-builder test**

`packages/shared/src/prompts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCoachSystemPrompt } from "./prompts";
import { emptyCoachMemory, type CoachMemory } from "./coach-memory-schema";

describe("buildCoachSystemPrompt", () => {
  it("works with no memory and no scenario (backwards compatible)", () => {
    const out = buildCoachSystemPrompt({
      targetLanguage: "it",
      userDisplayName: "Bruno",
    });
    expect(out).toContain("Lisa");
    expect(out).toContain("Italian");
    expect(out).toContain("Bruno");
    expect(out).not.toContain("<context>");
    expect(out).not.toContain("<scenario>");
  });

  it("injects a <context> block when memory is provided", () => {
    const memory: CoachMemory = {
      ...emptyCoachMemory(),
      proficiency_level: "B1",
      recent_topics: [
        {
          topic: "trip to Italy",
          last_practiced_at: "2026-05-30T10:00:00.000Z",
        },
      ],
      last_session_summary: "Talked about food.",
    };
    const out = buildCoachSystemPrompt({
      targetLanguage: "it",
      userDisplayName: "Bruno",
      memory,
      memoryDepth: "basic",
    });
    expect(out).toContain("<context>");
    expect(out).toContain("trip to Italy");
    expect(out).toContain("Talked about food.");
    // basic depth must NOT leak personal_context / weak_areas
    expect(out).not.toContain("personal_context");
  });

  it("includes deep memory when memoryDepth is deep", () => {
    const memory: CoachMemory = {
      ...emptyCoachMemory(),
      weak_areas: ["past tense"],
      personal_context: { job: "engineer" },
    };
    const out = buildCoachSystemPrompt({
      targetLanguage: "it",
      userDisplayName: "Bruno",
      memory,
      memoryDepth: "deep",
    });
    expect(out).toContain("past tense");
    expect(out).toContain("engineer");
  });

  it("injects a <scenario> block when a scenario is provided", () => {
    const out = buildCoachSystemPrompt({
      targetLanguage: "it",
      userDisplayName: "Bruno",
      scenario: {
        id: "coffee",
        systemPromptFragment:
          "You are the barista at a small Italian café. Greet the user, take their order, and introduce one twist (the espresso machine is broken).",
      },
    });
    expect(out).toContain("<scenario>");
    expect(out).toContain("barista");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd packages/shared && pnpm test src/prompts.test.ts
```

Expected: FAIL (memory and scenario params not yet supported).

- [ ] **Step 3: Extend `buildCoachSystemPrompt`**

Replace the contents of `packages/shared/src/prompts.ts`:

```ts
import { LANGUAGES } from "./languages";
import type { CoachMemory } from "./coach-memory-schema";

export type MemoryDepth = "basic" | "deep";

export type CoachScenarioFragment = {
  id: string;
  systemPromptFragment: string;
};

export type CoachPromptInput = {
  targetLanguage: string; // ISO 639-1
  userDisplayName: string;
  memory?: CoachMemory | null;
  memoryDepth?: MemoryDepth; // defaults to "basic" when memory provided
  scenario?: CoachScenarioFragment | null;
};

function basicMemoryBlock(memory: CoachMemory): string {
  const parts: string[] = [];
  if (memory.proficiency_level) {
    parts.push(`Approximate level: ${memory.proficiency_level}.`);
  }
  if (memory.recent_topics.length > 0) {
    const recent = memory.recent_topics
      .slice(-5)
      .map((t) => t.topic)
      .join(", ");
    parts.push(`Recent topics you've discussed together: ${recent}.`);
  }
  if (memory.last_session_summary) {
    parts.push(`Last session: ${memory.last_session_summary}`);
  }
  return parts.join(" ");
}

function deepMemoryBlock(memory: CoachMemory): string {
  const parts: string[] = [];
  if (memory.weak_areas.length > 0) {
    parts.push(
      `Known weak areas to gently revisit: ${memory.weak_areas.join(", ")}.`,
    );
  }
  const ctx = memory.personal_context;
  const personal: string[] = [];
  if (ctx.job) personal.push(`works as ${ctx.job}`);
  if (ctx.hobbies?.length)
    personal.push(`hobbies include ${ctx.hobbies.join(", ")}`);
  if (ctx.family) personal.push(`family: ${ctx.family}`);
  if (ctx.location) personal.push(`based in ${ctx.location}`);
  if (ctx.motivations?.length)
    personal.push(`learning to ${ctx.motivations.join(", ")}`);
  if (personal.length > 0) {
    parts.push(`The student ${personal.join("; ")}.`);
  }
  return parts.join(" ");
}

export function buildCoachSystemPrompt(input: CoachPromptInput): string {
  const lang =
    LANGUAGES.find((l) => l.code === input.targetLanguage) ?? LANGUAGES[0]!;
  const base = [
    `Your name is Lisa. You are a kind, patient ${lang.englishName} language coach.`,
    `You are talking to ${input.userDisplayName}.`,
    `Speak only in ${lang.englishName} (${lang.nativeName}).`,
    `When the user makes a grammar or vocabulary mistake, gently correct them with a brief explanation, then continue the conversation naturally.`,
    `Keep responses short — 1-3 sentences typically — as if speaking on a video call.`,
    `Never break character. Never switch to English unless the user explicitly asks for help.`,
    `Never mention being ChatGPT, GPT, OpenAI, or any specific AI model — if asked, you are simply Lisa, a friendly language coach.`,
  ].join(" ");

  const blocks: string[] = [base];

  if (input.memory) {
    const depth = input.memoryDepth ?? "basic";
    const basic = basicMemoryBlock(input.memory);
    const deep = depth === "deep" ? deepMemoryBlock(input.memory) : "";
    const ctxParts = [basic, deep].filter(Boolean);
    if (ctxParts.length > 0) {
      blocks.push(
        `<context>${ctxParts.join(" ")} Reference these naturally when relevant — do not list them robotically.</context>`,
      );
    }
  }

  if (input.scenario) {
    blocks.push(`<scenario>${input.scenario.systemPromptFragment}</scenario>`);
  }

  return blocks.join("\n\n");
}
```

- [ ] **Step 4: Run prompt tests to verify they pass**

```
cd packages/shared && pnpm test src/prompts.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Wire memory READ in voice.ts /turns**

Modify `apps/api/src/routes/voice.ts`. In the `/sessions/:id/turns` handler, after loading `profile` and before building `sysPrompt`, add:

```ts
// Load coach memory for this user × language (Plan 8 M1).
// If user opted out of memory, treat as no memory.
const memoryRow = await deps.db.query.coachMemory.findFirst({
  where: (t, { eq: e, and: a }) =>
    a(e(t.userId, userId), e(t.languageCode, conversation.language)),
});
const entitlementForMemory = entitlement; // already loaded above
const memoryDepth =
  entitlementForMemory.plan === "pro" &&
  entitlementForMemory.proUntil &&
  entitlementForMemory.proUntil > new Date()
    ? ("deep" as const)
    : ("basic" as const);
const memory =
  memoryRow && !memoryRow.optedOut
    ? {
        proficiency_level:
          (memoryRow.proficiencyLevel as
            | "A1"
            | "A2"
            | "B1"
            | "B2"
            | "C1"
            | "C2"
            | null) ?? null,
        recent_topics:
          (memoryRow.recentTopics as Array<{
            topic: string;
            last_practiced_at: string;
          }>) ?? [],
        weak_areas: (memoryRow.weakAreas as string[]) ?? [],
        personal_context:
          (memoryRow.personalContext as Record<string, unknown>) ?? {},
        last_session_summary: memoryRow.lastSessionSummary,
      }
    : null;
```

Then change the `sysPrompt` line from:

```ts
const sysPrompt = buildCoachSystemPrompt({
  targetLanguage: conversation.language,
  userDisplayName: profile.displayName,
});
```

to:

```ts
const sysPrompt = buildCoachSystemPrompt({
  targetLanguage: conversation.language,
  userDisplayName: profile.displayName,
  memory,
  memoryDepth,
});
```

Also add the `coachMemory` import at the top of voice.ts:

```ts
import {
  conversations,
  messages,
  entitlements,
  coachMemory,
} from "../db/schema";
```

(replace the existing schema import line).

- [ ] **Step 6: Wire memory WRITE in voice.ts /end**

In the `/sessions/:id/end` handler (the one at `voice.ts:345-418`), AFTER the streak upsert and BEFORE the `return c.json(...)`, add the fire-and-forget extraction call:

```ts
// Plan 8 M1: fire-and-forget memory extraction. Never block the response.
void (async () => {
  try {
    const memoryRow = await deps.db.query.coachMemory.findFirst({
      where: (t, { eq: e, and: a }) =>
        a(e(t.userId, userId), e(t.languageCode, conversation.language)),
    });
    if (memoryRow?.optedOut) return;
    const existingMemory = memoryRow
      ? {
          proficiency_level: memoryRow.proficiencyLevel as
            | "A1"
            | "A2"
            | "B1"
            | "B2"
            | "C1"
            | "C2"
            | null,
          recent_topics:
            (memoryRow.recentTopics as Array<{
              topic: string;
              last_practiced_at: string;
            }>) ?? [],
          weak_areas: (memoryRow.weakAreas as string[]) ?? [],
          personal_context:
            (memoryRow.personalContext as Record<string, unknown>) ?? {},
          last_session_summary: memoryRow.lastSessionSummary,
        }
      : emptyCoachMemory();
    const transcript = await deps.db.query.messages.findMany({
      where: (t, { eq: e }) => e(t.conversationId, conversationId),
      orderBy: (t, { asc: a }) => [a(t.createdAt)],
    });
    const ttranscript = transcript.map((m) => ({
      role: (m.role === "coach" ? "coach" : "user") as "coach" | "user",
      text: m.text,
    }));
    const onUsage = makeOnUsage(deps.db, {
      userId,
      platform: platformFromHeader(c.req.header("X-Client-Platform")),
      conversationId,
    });
    const updated = await deps.extractMemory({
      existingMemory,
      transcript: ttranscript,
      languageCode: conversation.language,
      onUsage,
    });
    if (!updated) return; // parse failure already swallowed inside extractMemory
    await deps.db
      .insert(coachMemory)
      .values({
        userId,
        languageCode: conversation.language,
        proficiencyLevel: updated.proficiency_level ?? null,
        recentTopics: updated.recent_topics,
        weakAreas: updated.weak_areas,
        personalContext: updated.personal_context,
        lastSessionSummary: updated.last_session_summary ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [coachMemory.userId, coachMemory.languageCode],
        set: {
          proficiencyLevel: updated.proficiency_level ?? null,
          recentTopics: updated.recent_topics,
          weakAreas: updated.weak_areas,
          personalContext: updated.personal_context,
          lastSessionSummary: updated.last_session_summary ?? null,
          updatedAt: new Date(),
        },
      });
  } catch {
    // Memory extraction never breaks the user-visible flow.
  }
})();
```

Add to the imports at the top of voice.ts:

```ts
import { emptyCoachMemory } from "@language-coach/shared";
```

- [ ] **Step 7: Wire extractMemory into VoiceDeps**

Update `VoiceDeps` near the top of voice.ts:

```ts
export type ExtractMemoryFn = (input: {
  existingMemory: import("@language-coach/shared").CoachMemory;
  transcript: Array<{ role: "user" | "coach"; text: string }>;
  languageCode: string;
  onUsage?: import("../providers/usage").OnUsage;
}) => Promise<import("@language-coach/shared").CoachMemory | null>;

export type VoiceDeps = {
  db: Database;
  transcribeAudio: (input: TranscribeInput) => Promise<TranscribeResult>;
  streamChatCompletion: (input: StreamInput) => AsyncGenerator<string>;
  synthesizeSpeech: SynthesizeSpeechFn;
  uploadCoachAudioChunk: UploadCoachAudioChunkFn;
  extractMemory: ExtractMemoryFn; // NEW
};
```

- [ ] **Step 8: Pass extractMemory in app.ts**

Modify `apps/api/src/app.ts`. In the `createVoiceRoutes({ ... })` call (around line 187), add:

```ts
import { extractMemory } from "./lib/extract-memory";
// ... in createVoiceRoutes call:
      extractMemory: (input) =>
        extractMemory(openai, input),
```

- [ ] **Step 9: Run all api tests to confirm nothing broke**

```
cd apps/api && pnpm test
```

Expected: All existing tests still pass. If `voice.test.ts` fails because `extractMemory` is missing from its stub `deps`, add a no-op stub:

```ts
extractMemory: async () => null,
```

- [ ] **Step 10: Commit**

```bash
git add packages/shared/src/prompts.ts packages/shared/src/prompts.test.ts \
        apps/api/src/routes/voice.ts apps/api/src/app.ts apps/api/src/routes/voice.test.ts
git commit -m "$(cat <<'EOF'
feat(api): coach memory read/write integration

buildCoachSystemPrompt now accepts memory + memoryDepth + scenario.
voice.ts /turns injects basic-or-deep memory based on entitlement.
voice.ts /end fires gpt-4o-mini extraction fire-and-forget.

Plan 8 M1 Task 4. Test on device: start a session, talk about a
specific topic, end it, start a new session — coach should reference
the previous topic in the opening line.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### ✅ Milestone 1 Test Checkpoint (Bruno on device)

1. Deploy API to Fly: push to a branch and let CI deploy, or `flyctl deploy` manually
2. Run `eas build --profile development --platform android` and install on phone (or use Metro hot-reload if working)
3. Start an Italian conversation. Say: "I want to plan a trip to Rome next summer." Talk for ~3 min. End.
4. Start a new Italian conversation. Coach's first reply should reference Rome / trip / summer.
5. Inspect the DB: `SELECT * FROM coach_memory WHERE user_id = ...` — should show recent_topics with "trip to Rome" or similar.

**If coach doesn't reference prior topic:** Most common cause = memory row missing (extraction failed; check Sentry for the swallowed error). Second most common = depth mismatch (Pro user should see deep, free should see basic — check `entitlement.plan`).

---

# Milestone 2 — Memory editor UI + Feedback API (Tasks 5–9)

**Goal:** Bruno can view and edit his coach's memory under Profile, and an end-of-session feedback record is generated and retrievable via API (no UI for it yet — Milestone 3).

---

### Task 5: Memory consent screen in onboarding

**Files:**

- Create: `apps/mobile/app/(onboarding)/memory-consent.tsx`
- Modify: `apps/mobile/app/(onboarding)/_layout.tsx` (if it explicitly lists screens)
- Modify: existing onboarding final-step navigation to push `/memory-consent` instead of `/(tabs)/home` directly.

This is the simplest mobile task. Read the existing onboarding flow first to match the pattern.

- [ ] **Step 1: Read the existing final onboarding step**

```
ls apps/mobile/app/(onboarding)/
```

Read the file that currently navigates to `/(tabs)/home` after `complete_onboarding` RPC. (Likely `daily-goal.tsx` or similar — find the one that calls the RPC and the navigation that follows.)

- [ ] **Step 2: Create the memory-consent screen**

`apps/mobile/app/(onboarding)/memory-consent.tsx`:

```tsx
import { useState } from "react";
import { StyleSheet, View, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { EditorialText, Screen } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";
import { useProfile } from "@/src/features/auth/use-profile";
import { useUpdateMemoryConsent } from "@/src/features/coach-memory/use-update-memory-consent";

export default function MemoryConsentScreen() {
  const { data: profile } = useProfile();
  const targetLang = profile?.target_lang ?? "en";
  const [busy, setBusy] = useState(false);
  const updateConsent = useUpdateMemoryConsent();

  const onAccept = async () => {
    setBusy(true);
    try {
      await updateConsent.mutateAsync({
        languageCode: targetLang,
        optedOut: false,
      });
      router.replace("/(tabs)/home");
    } catch (e) {
      Alert.alert("Couldn't save your choice", String(e));
    } finally {
      setBusy(false);
    }
  };

  const onSkip = async () => {
    setBusy(true);
    try {
      await updateConsent.mutateAsync({
        languageCode: targetLang,
        optedOut: true,
      });
      router.replace("/(tabs)/home");
    } catch (e) {
      Alert.alert("Couldn't save your choice", String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen variant="gradient">
      <View style={styles.container}>
        <EditorialText kind="displayMd" italic style={styles.title}>
          Your coach remembers you
        </EditorialText>
        <EditorialText
          kind="bodyMd"
          color={palette.inkSoft}
          style={styles.body}
        >
          To make conversations feel like real coaching, we save a short profile
          of what you've talked about, your level, and topics you'd like to
          practice.
        </EditorialText>
        <EditorialText
          kind="bodyMd"
          color={palette.inkSoft}
          style={styles.body}
        >
          You can view, edit, or delete this memory anytime under Profile →
          Coach's Memory.
        </EditorialText>
        <Pressable
          onPress={onAccept}
          style={[styles.cta, busy && styles.disabled]}
          disabled={busy}
        >
          <EditorialText kind="bodyMd" color={palette.peach}>
            Continue
          </EditorialText>
        </Pressable>
        <Pressable
          onPress={onSkip}
          style={[styles.skip, busy && styles.disabled]}
          disabled={busy}
        >
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            Skip — I don't want my coach to remember me
          </EditorialText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  title: { marginBottom: spacing.lg, color: palette.ink },
  body: { marginBottom: spacing.base },
  cta: {
    marginTop: spacing.xl,
    backgroundColor: palette.ink,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    ...shadow.cta,
  },
  skip: {
    marginTop: spacing.md,
    padding: spacing.md,
    alignItems: "center",
  },
  disabled: { opacity: 0.5 },
});
```

- [ ] **Step 3: Create the consent-update hook**

`apps/mobile/src/features/coach-memory/use-update-memory-consent.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/src/lib/api-client";

export type UpdateConsentInput = {
  languageCode: string;
  optedOut: boolean;
};

export function useUpdateMemoryConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateConsentInput) => {
      const res = await apiClient.put("/v1/memory/consent", {
        body: { language_code: input.languageCode, opted_out: input.optedOut },
      });
      return res;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach-memory"] });
    },
  });
}
```

- [ ] **Step 4: Update the onboarding final step**

Find the existing screen that currently does `router.replace("/(tabs)/home")` after onboarding completes. Replace that line with `router.replace("/(onboarding)/memory-consent")`.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/(onboarding)/memory-consent.tsx \
        apps/mobile/src/features/coach-memory/use-update-memory-consent.ts \
        apps/mobile/app/(onboarding)/<final-step>.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): memory consent screen in onboarding

Plan 8 M2 Task 5. Sets coach_memory.opted_out per user × language.
API endpoint /v1/memory/consent ships in Task 6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Memory endpoints (consent + read + update + delete)

**Files:**

- Create: `apps/api/src/routes/memory.ts`
- Create: `apps/api/src/routes/memory.test.ts`
- Modify: `apps/api/src/app.ts` (mount `/v1/memory/*`)
- Create: `apps/mobile/app/(tabs)/profile/memory.tsx`
- Create: `apps/mobile/src/features/coach-memory/use-coach-memory.ts`
- Create: `apps/mobile/src/features/coach-memory/use-update-memory.ts`
- Modify: `apps/mobile/app/(tabs)/profile.tsx` (add a row linking to /profile/memory)

- [ ] **Step 1: Write the failing route test**

`apps/api/src/routes/memory.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import { createMemoryRoutes } from "./memory";

function makeDeps() {
  const memoryStore: any[] = [];
  return {
    db: {
      query: {
        coachMemory: {
          findMany: vi.fn(async () => memoryStore),
          findFirst: vi.fn(async (opts: any) => {
            // simplified — caller passes language_code; we ignore for stub
            return memoryStore[0] ?? null;
          }),
        },
      },
      insert: vi.fn(() => ({
        values: vi.fn((v: any) => ({
          onConflictDoUpdate: vi.fn(() => {
            memoryStore[0] = { ...memoryStore[0], ...v };
            return [];
          }),
        })),
      })),
      delete: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
    } as any,
  };
}

describe("memory routes", () => {
  it("PUT /memory/consent upserts opted_out for the user × language", async () => {
    const deps = makeDeps();
    const routes = createMemoryRoutes(deps);
    const res = await routes.fetch(
      new Request("http://x/consent", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language_code: "it", opted_out: false }),
      }),
      { userId: "u1" } as any,
    );
    expect(res.status).toBe(200);
  });
});
```

(Real Hono test harness has slightly different invocation; match the closest pattern in existing tests — `health.test.ts` or `messages.test.ts` — and adapt.)

- [ ] **Step 2: Run test to verify it fails**

```
cd apps/api && pnpm test src/routes/memory.test.ts
```

Expected: FAIL (`createMemoryRoutes` not exported).

- [ ] **Step 3: Implement the routes**

`apps/api/src/routes/memory.ts`:

```ts
import { Hono } from "hono";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { Database } from "../db";
import { coachMemory } from "../db/schema";
import {
  CoachMemorySchema,
  emptyCoachMemory,
  type CoachMemory,
} from "@language-coach/shared";

export type MemoryDeps = { db: Database };

const ConsentBody = z.object({
  language_code: z.string().min(2).max(8),
  opted_out: z.boolean(),
});

const UpdateBody = z.object({
  language_code: z.string().min(2).max(8),
  memory: CoachMemorySchema,
});

export function createMemoryRoutes(deps: MemoryDeps) {
  const routes = new Hono<{ Variables: { userId: string } }>();

  // GET /v1/memory - list all memories for the user (across languages)
  routes.get("/", async (c) => {
    const userId = c.get("userId");
    const rows = await deps.db.query.coachMemory.findMany({
      where: (t, { eq: e }) => e(t.userId, userId),
    });
    return c.json({
      memories: rows.map((r) => ({
        language_code: r.languageCode,
        opted_out: r.optedOut,
        memory: {
          proficiency_level: r.proficiencyLevel,
          recent_topics: r.recentTopics,
          weak_areas: r.weakAreas,
          personal_context: r.personalContext,
          last_session_summary: r.lastSessionSummary,
        } satisfies CoachMemory,
        updated_at: r.updatedAt,
      })),
    });
  });

  // PUT /v1/memory/consent
  routes.put("/consent", async (c) => {
    const userId = c.get("userId");
    const body = await c.req.json().catch(() => ({}));
    const parsed = ConsentBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: parsed.error.message } },
        400,
      );
    }
    const empty = emptyCoachMemory();
    await deps.db
      .insert(coachMemory)
      .values({
        userId,
        languageCode: parsed.data.language_code,
        optedOut: parsed.data.opted_out,
        recentTopics: empty.recent_topics,
        weakAreas: empty.weak_areas,
        personalContext: empty.personal_context,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [coachMemory.userId, coachMemory.languageCode],
        set: { optedOut: parsed.data.opted_out, updatedAt: new Date() },
      });
    return c.json({ ok: true });
  });

  // PUT /v1/memory  — user-edited memory
  routes.put("/", async (c) => {
    const userId = c.get("userId");
    const body = await c.req.json().catch(() => ({}));
    const parsed = UpdateBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: parsed.error.message } },
        400,
      );
    }
    const m = parsed.data.memory;
    await deps.db
      .insert(coachMemory)
      .values({
        userId,
        languageCode: parsed.data.language_code,
        proficiencyLevel: m.proficiency_level ?? null,
        recentTopics: m.recent_topics,
        weakAreas: m.weak_areas,
        personalContext: m.personal_context,
        lastSessionSummary: m.last_session_summary ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [coachMemory.userId, coachMemory.languageCode],
        set: {
          proficiencyLevel: m.proficiency_level ?? null,
          recentTopics: m.recent_topics,
          weakAreas: m.weak_areas,
          personalContext: m.personal_context,
          lastSessionSummary: m.last_session_summary ?? null,
          updatedAt: new Date(),
        },
      });
    return c.json({ ok: true });
  });

  // DELETE /v1/memory/:languageCode
  routes.delete("/:languageCode", async (c) => {
    const userId = c.get("userId");
    const languageCode = c.req.param("languageCode");
    await deps.db
      .delete(coachMemory)
      .where(
        and(
          eq(coachMemory.userId, userId),
          eq(coachMemory.languageCode, languageCode),
        ),
      );
    return c.json({ ok: true });
  });

  return routes;
}
```

- [ ] **Step 4: Mount in app.ts**

Modify `apps/api/src/app.ts` to add (alongside other `/v1/*` routes):

```ts
import { createMemoryRoutes } from "./routes/memory";
// ...
app.route("/v1/memory", createMemoryRoutes({ db }));
```

- [ ] **Step 5: Run test to verify it passes**

```
cd apps/api && pnpm test src/routes/memory.test.ts
```

Expected: PASS.

- [ ] **Step 6: Create the mobile memory editor**

`apps/mobile/src/features/coach-memory/use-coach-memory.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/src/lib/api-client";
import type { CoachMemory } from "@language-coach/shared";

export type CoachMemoryEntry = {
  language_code: string;
  opted_out: boolean;
  memory: CoachMemory;
  updated_at: string;
};

export function useCoachMemory() {
  return useQuery<{ memories: CoachMemoryEntry[] }>({
    queryKey: ["coach-memory"],
    queryFn: async () => apiClient.get("/v1/memory"),
  });
}
```

`apps/mobile/src/features/coach-memory/use-update-memory.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/src/lib/api-client";
import type { CoachMemory } from "@language-coach/shared";

export function useUpdateMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { languageCode: string; memory: CoachMemory }) =>
      apiClient.put("/v1/memory", {
        body: { language_code: input.languageCode, memory: input.memory },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coach-memory"] }),
  });
}

export function useDeleteMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (languageCode: string) =>
      apiClient.delete(`/v1/memory/${languageCode}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coach-memory"] }),
  });
}
```

`apps/mobile/app/(tabs)/profile/memory.tsx`:

```tsx
import {
  ScrollView,
  StyleSheet,
  View,
  TextInput,
  Pressable,
  Alert,
} from "react-native";
import { Stack } from "expo-router";
import { useState, useEffect } from "react";
import { EditorialText, Screen } from "@/src/design";
import { palette, radius, spacing } from "@language-coach/design-tokens";
import {
  useCoachMemory,
  type CoachMemoryEntry,
} from "@/src/features/coach-memory/use-coach-memory";
import {
  useUpdateMemory,
  useDeleteMemory,
} from "@/src/features/coach-memory/use-update-memory";
import { LANGUAGES } from "@language-coach/shared";

export default function MemoryEditorScreen() {
  const { data, isLoading } = useCoachMemory();
  return (
    <Screen variant="gradient">
      <Stack.Screen options={{ title: "Coach's Memory" }} />
      <ScrollView contentContainerStyle={styles.container}>
        <EditorialText
          kind="bodyMd"
          color={palette.inkSoft}
          style={styles.intro}
        >
          What your coach remembers about you. Edit freely — your changes apply
          on your next session.
        </EditorialText>
        {isLoading && (
          <EditorialText kind="bodyMd" color={palette.inkSoft}>
            Loading…
          </EditorialText>
        )}
        {data?.memories.length === 0 && (
          <EditorialText kind="bodyMd" color={palette.inkSoft}>
            Your coach hasn't gathered any memory yet. Have a conversation
            first.
          </EditorialText>
        )}
        {data?.memories.map((entry) => (
          <MemoryCard key={entry.language_code} entry={entry} />
        ))}
      </ScrollView>
    </Screen>
  );
}

function MemoryCard({ entry }: { entry: CoachMemoryEntry }) {
  const update = useUpdateMemory();
  const del = useDeleteMemory();
  const lang = LANGUAGES.find((l) => l.code === entry.language_code);
  const [summary, setSummary] = useState(
    entry.memory.last_session_summary ?? "",
  );
  const [topics, setTopics] = useState(
    entry.memory.recent_topics.map((t) => t.topic).join("\n"),
  );
  const [weakAreas, setWeakAreas] = useState(
    entry.memory.weak_areas.join("\n"),
  );

  useEffect(() => {
    setSummary(entry.memory.last_session_summary ?? "");
    setTopics(entry.memory.recent_topics.map((t) => t.topic).join("\n"));
    setWeakAreas(entry.memory.weak_areas.join("\n"));
  }, [entry]);

  const onSave = () => {
    update.mutate({
      languageCode: entry.language_code,
      memory: {
        ...entry.memory,
        last_session_summary: summary || null,
        recent_topics: topics
          .split("\n")
          .map((t) => t.trim())
          .filter(Boolean)
          .map((t) => ({
            topic: t,
            last_practiced_at: new Date().toISOString(),
          })),
        weak_areas: weakAreas
          .split("\n")
          .map((t) => t.trim())
          .filter(Boolean),
      },
    });
  };

  const onDelete = () => {
    Alert.alert(
      `Delete ${lang?.englishName ?? entry.language_code} memory?`,
      "Your coach will start over fresh for this language.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => del.mutate(entry.language_code),
        },
      ],
    );
  };

  return (
    <View style={styles.card}>
      <EditorialText kind="bodyMd" style={styles.langTitle}>
        {lang?.englishName ?? entry.language_code}
      </EditorialText>
      <EditorialText kind="bodySm" color={palette.inkSoft}>
        Recent topics (one per line)
      </EditorialText>
      <TextInput
        multiline
        value={topics}
        onChangeText={setTopics}
        style={styles.input}
      />
      <EditorialText kind="bodySm" color={palette.inkSoft}>
        Weak areas (one per line)
      </EditorialText>
      <TextInput
        multiline
        value={weakAreas}
        onChangeText={setWeakAreas}
        style={styles.input}
      />
      <EditorialText kind="bodySm" color={palette.inkSoft}>
        Last session summary
      </EditorialText>
      <TextInput
        multiline
        value={summary}
        onChangeText={setSummary}
        style={styles.input}
      />
      <View style={styles.row}>
        <Pressable
          onPress={onSave}
          style={[styles.btn, styles.btnSave]}
          disabled={update.isPending}
        >
          <EditorialText kind="bodyMd" color={palette.peach}>
            {update.isPending ? "Saving…" : "Save"}
          </EditorialText>
        </Pressable>
        <Pressable
          onPress={onDelete}
          style={[styles.btn, styles.btnDelete]}
          disabled={del.isPending}
        >
          <EditorialText kind="bodyMd" color={palette.danger}>
            Delete this language's memory
          </EditorialText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.base, gap: spacing.lg },
  intro: { marginBottom: spacing.md },
  card: {
    backgroundColor: palette.glassStrong,
    borderRadius: radius.lg,
    padding: spacing.base,
    gap: spacing.sm,
  },
  langTitle: {
    color: palette.ink,
    marginBottom: spacing.sm,
    fontWeight: "600",
  },
  input: {
    backgroundColor: palette.cream,
    borderRadius: radius.md,
    padding: spacing.sm,
    minHeight: 80,
    textAlignVertical: "top",
    color: palette.ink,
  },
  row: { gap: spacing.sm, marginTop: spacing.md },
  btn: {
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
  },
  btnSave: { backgroundColor: palette.ink },
  btnDelete: { backgroundColor: palette.glass },
});
```

- [ ] **Step 7: Link the editor from Profile**

Modify `apps/mobile/app/(tabs)/profile.tsx` — add a row that navigates to `/profile/memory`. Match the existing styling pattern for setting rows in that file. Use `router.push("/(tabs)/profile/memory")`.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/routes/memory.ts apps/api/src/routes/memory.test.ts apps/api/src/app.ts \
        apps/mobile/app/(tabs)/profile/memory.tsx apps/mobile/app/(tabs)/profile.tsx \
        apps/mobile/src/features/coach-memory/use-coach-memory.ts \
        apps/mobile/src/features/coach-memory/use-update-memory.ts
git commit -m "$(cat <<'EOF'
feat(api+mobile): memory CRUD + Profile editor

GET/PUT/DELETE /v1/memory and /v1/memory/consent. Mobile Profile gets a
"Coach's Memory" link to per-language editor screen.

Plan 8 M2 Task 6.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: session_feedback schema + Zod + migration

**Files:**

- Create: `apps/api/src/db/migrations/0011_session_feedback.sql`
- Create: `apps/api/src/db/schema/session-feedback.ts`
- Modify: `apps/api/src/db/schema/index.ts`
- Create: `packages/shared/src/feedback-schema.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `packages/shared/src/feedback-schema.test.ts`

Mirror the Task 1 pattern (schema test → schema → migration → run-migrations → commit). Shorter because the pattern is established.

- [ ] **Step 1: SQL migration**

`apps/api/src/db/migrations/0011_session_feedback.sql`:

```sql
CREATE TABLE session_feedback (
  conversation_id uuid PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
  highlights      jsonb NOT NULL DEFAULT '[]'::jsonb,
  corrections     jsonb NOT NULL DEFAULT '[]'::jsonb,
  vocab           jsonb NOT NULL DEFAULT '[]'::jsonb,
  status          text NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE session_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_feedback_all_own" ON session_feedback
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = session_feedback.conversation_id AND c.user_id = auth.uid()
    )
  );

ALTER TABLE session_feedback
  ADD CONSTRAINT session_feedback_status_check
  CHECK (status IN ('pending', 'ready', 'failed'));
```

- [ ] **Step 2: Drizzle schema**

`apps/api/src/db/schema/session-feedback.ts`:

```ts
import { pgTable, uuid, jsonb, text, timestamp } from "drizzle-orm/pg-core";
import { conversations } from "./conversations";

export const sessionFeedback = pgTable("session_feedback", {
  conversationId: uuid("conversation_id")
    .primaryKey()
    .references(() => conversations.id, { onDelete: "cascade" }),
  highlights: jsonb("highlights").notNull().default([]),
  corrections: jsonb("corrections").notNull().default([]),
  vocab: jsonb("vocab").notNull().default([]),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type SessionFeedbackRow = typeof sessionFeedback.$inferSelect;
export type NewSessionFeedbackRow = typeof sessionFeedback.$inferInsert;
```

Add `export * from "./session-feedback";` to `index.ts`.

- [ ] **Step 3: Zod schema in shared**

`packages/shared/src/feedback-schema.ts`:

```ts
import { z } from "zod";

export const HighlightSchema = z.object({
  phrase: z.string().min(1).max(240),
  why: z.string().min(1).max(240),
});

export const CorrectionSchema = z.object({
  you_said: z.string().min(1).max(240),
  better: z.string().min(1).max(240),
  explanation: z.string().min(1).max(280),
});

export const VocabItemSchema = z.object({
  term: z.string().min(1).max(120),
  translation: z.string().min(1).max(120),
  source_phrase: z.string().max(280).optional(),
});

export const SessionFeedbackSchema = z
  .object({
    highlights: z.array(HighlightSchema).max(5),
    corrections: z.array(CorrectionSchema).max(5),
    vocab: z.array(VocabItemSchema).max(10),
  })
  .strict();

export type SessionFeedback = z.infer<typeof SessionFeedbackSchema>;
export type Highlight = z.infer<typeof HighlightSchema>;
export type Correction = z.infer<typeof CorrectionSchema>;
export type VocabItem = z.infer<typeof VocabItemSchema>;
```

Add `export * from "./feedback-schema";` to shared `index.ts`.

- [ ] **Step 4: Quick Zod test**

`packages/shared/src/feedback-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SessionFeedbackSchema } from "./feedback-schema";

describe("SessionFeedbackSchema", () => {
  it("accepts the empty shape", () => {
    expect(() =>
      SessionFeedbackSchema.parse({
        highlights: [],
        corrections: [],
        vocab: [],
      }),
    ).not.toThrow();
  });
  it("rejects extra root keys", () => {
    expect(() =>
      SessionFeedbackSchema.parse({
        highlights: [],
        corrections: [],
        vocab: [],
        bonus: "no",
      }),
    ).toThrow();
  });
});
```

- [ ] **Step 5: Run migrations and tests**

```
cd apps/api && pnpm db:migrate && pnpm test src/db/schema/
cd packages/shared && pnpm test src/feedback-schema.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/db/migrations/0011_session_feedback.sql \
        apps/api/src/db/schema/session-feedback.ts \
        apps/api/src/db/schema/index.ts \
        packages/shared/src/feedback-schema.ts \
        packages/shared/src/feedback-schema.test.ts \
        packages/shared/src/index.ts
git commit -m "$(cat <<'EOF'
feat(api+shared): session_feedback schema + Zod

Plan 8 M2 Task 7.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Feedback generation function + fire from /end

**Files:**

- Create: `apps/api/src/lib/generate-feedback.ts`
- Create: `apps/api/src/lib/generate-feedback.test.ts`
- Modify: `apps/api/src/routes/voice.ts` (fire from /end, add to VoiceDeps)
- Modify: `apps/api/src/app.ts` (pass generateFeedback dep)

- [ ] **Step 1: Failing test**

`apps/api/src/lib/generate-feedback.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { generateFeedback } from "./generate-feedback";

const okClient = {
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                highlights: [
                  { phrase: "Buongiorno!", why: "Natural greeting." },
                ],
                corrections: [
                  {
                    you_said: "io andato",
                    better: "io sono andato",
                    explanation: "Motion verbs in Italian use 'essere'.",
                  },
                ],
                vocab: [{ term: "panino", translation: "sandwich" }],
              }),
            },
          },
        ],
        usage: { prompt_tokens: 600, completion_tokens: 180 },
      }),
    },
  },
};

describe("generateFeedback", () => {
  it("returns parsed feedback on happy path", async () => {
    const out = await generateFeedback(okClient as any, {
      transcript: [
        { role: "user", text: "Buongiorno!" },
        { role: "coach", text: "Ciao!" },
      ],
      languageCode: "it",
      nativeLanguageCode: "en",
    });
    expect(out).not.toBeNull();
    expect(out!.corrections[0]!.better).toBe("io sono andato");
  });

  it("returns null on invalid JSON", async () => {
    const badClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "not json" } }],
            usage: { prompt_tokens: 100, completion_tokens: 10 },
          }),
        },
      },
    };
    const out = await generateFeedback(badClient as any, {
      transcript: [{ role: "user", text: "hi" }],
      languageCode: "it",
      nativeLanguageCode: "en",
    });
    expect(out).toBeNull();
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```
cd apps/api && pnpm test src/lib/generate-feedback.test.ts
```

- [ ] **Step 3: Implement**

`apps/api/src/lib/generate-feedback.ts`:

```ts
import type OpenAI from "openai";
import {
  SessionFeedbackSchema,
  type SessionFeedback,
  LANGUAGES,
} from "@language-coach/shared";
import type { OnUsage } from "../providers/usage";
import type { TranscriptTurn } from "./extract-memory";

export type GenerateFeedbackInput = {
  transcript: TranscriptTurn[];
  languageCode: string;
  nativeLanguageCode: string;
  model?: string;
  onUsage?: OnUsage;
};

const SYSTEM_PROMPT = `You are a language-coaching feedback writer. You receive a transcript of a short conversation between a student and a coach.

You output ONLY a JSON object with three arrays:
- highlights (0-3 items): things the STUDENT said well. Each: { phrase, why }. "phrase" in the target language, "why" in the student's native language, max one sentence.
- corrections (0-3 items): clear mistakes the STUDENT made. Each: { you_said, better, explanation }. "you_said" is what the student actually said; "better" is the corrected form; "explanation" is one short sentence in the student's native language.
- vocab (0-8 items): new or interesting words / expressions worth remembering. Prefer items from the student's speech but include 1-2 from the coach if the student likely doesn't know them. Each: { term, translation, source_phrase }.

Rules:
- If uncertain about a grammar rule, omit the correction rather than fabricate.
- All counts are UPPER BOUNDS. If there's nothing of substance to say in a category, return an empty array.
- Output ONLY the JSON object, no commentary, no markdown fences.`;

export async function generateFeedback(
  client: OpenAI,
  input: GenerateFeedbackInput,
): Promise<SessionFeedback | null> {
  const target =
    LANGUAGES.find((l) => l.code === input.languageCode)?.englishName ??
    input.languageCode;
  const native =
    LANGUAGES.find((l) => l.code === input.nativeLanguageCode)?.englishName ??
    input.nativeLanguageCode;
  const transcriptText = input.transcript
    .map((t) => `${t.role.toUpperCase()}: ${t.text}`)
    .join("\n");
  const userPrompt = `Target language: ${target}
Student's native language: ${native}

TRANSCRIPT:
${transcriptText}

Return the feedback JSON:`;

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: input.model ?? "gpt-4o",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
  } catch {
    return null;
  }

  if (input.onUsage && completion.usage) {
    void Promise.resolve(
      input.onUsage({
        provider: "openai",
        operation: `feedback:${input.model ?? "gpt-4o"}`,
        inputTokens: completion.usage.prompt_tokens,
        outputTokens: completion.usage.completion_tokens,
      }),
    ).catch(() => {});
  }

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return SessionFeedbackSchema.parse(parsed);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test, expect pass**

```
cd apps/api && pnpm test src/lib/generate-feedback.test.ts
```

- [ ] **Step 5: Fire feedback gen from /end**

In `voice.ts /end` handler, ADD ANOTHER fire-and-forget block alongside the memory extraction block (Task 4 added). First, insert a pending row, then fire the gen job.

```ts
// Plan 8 M2: insert pending feedback row, then fire gen job.
void (async () => {
  try {
    await deps.db
      .insert(sessionFeedback)
      .values({
        conversationId,
        status: "pending",
        highlights: [],
        corrections: [],
        vocab: [],
      })
      .onConflictDoNothing();

    const transcript = await deps.db.query.messages.findMany({
      where: (t, { eq: e }) => e(t.conversationId, conversationId),
      orderBy: (t, { asc: a }) => [a(t.createdAt)],
    });
    const ttranscript = transcript.map((m) => ({
      role: (m.role === "coach" ? "coach" : "user") as "coach" | "user",
      text: m.text,
    }));
    const onUsage = makeOnUsage(deps.db, {
      userId,
      platform: platformFromHeader(c.req.header("X-Client-Platform")),
      conversationId,
    });
    const fb = await deps.generateFeedback({
      transcript: ttranscript,
      languageCode: conversation.language,
      nativeLanguageCode: profile.nativeLang,
      onUsage,
    });
    if (!fb) {
      await deps.db
        .update(sessionFeedback)
        .set({ status: "failed" })
        .where(eq(sessionFeedback.conversationId, conversationId));
      return;
    }
    await deps.db
      .update(sessionFeedback)
      .set({
        status: "ready",
        highlights: fb.highlights,
        corrections: fb.corrections,
        vocab: fb.vocab,
      })
      .where(eq(sessionFeedback.conversationId, conversationId));
  } catch {
    // already logged via Sentry through caught errors
  }
})();
```

Add to imports:

```ts
import { sessionFeedback } from "../db/schema";
```

Add `generateFeedback` to `VoiceDeps`:

```ts
export type GenerateFeedbackFn = (input: {
  transcript: Array<{ role: "user" | "coach"; text: string }>;
  languageCode: string;
  nativeLanguageCode: string;
  onUsage?: import("../providers/usage").OnUsage;
}) => Promise<import("@language-coach/shared").SessionFeedback | null>;

export type VoiceDeps = {
  // ... existing fields ...
  extractMemory: ExtractMemoryFn;
  generateFeedback: GenerateFeedbackFn; // NEW
};
```

- [ ] **Step 6: Pass generateFeedback in app.ts**

```ts
import { generateFeedback } from "./lib/generate-feedback";
// in createVoiceRoutes():
      generateFeedback: (input) => generateFeedback(openai, input),
```

- [ ] **Step 7: Run all api tests**

```
cd apps/api && pnpm test
```

Fix any existing `voice.test.ts` stubs by adding `generateFeedback: async () => null` to the deps.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/lib/generate-feedback.ts apps/api/src/lib/generate-feedback.test.ts \
        apps/api/src/routes/voice.ts apps/api/src/app.ts
git commit -m "$(cat <<'EOF'
feat(api): end-of-session feedback generation (gpt-4o)

Pending row at /end, gen job fires, status flips to ready/failed.
Plan 8 M2 Task 8.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: GET feedback endpoint

**Files:**

- Create: `apps/api/src/routes/feedback.ts`
- Create: `apps/api/src/routes/feedback.test.ts`
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Failing test, then implement**

`apps/api/src/routes/feedback.ts`:

```ts
import { Hono } from "hono";
import type { Database } from "../db";

export type FeedbackDeps = { db: Database };

export function createFeedbackRoutes(deps: FeedbackDeps) {
  const routes = new Hono<{ Variables: { userId: string } }>();

  // GET /v1/sessions/:id/feedback
  routes.get("/sessions/:id/feedback", async (c) => {
    const userId = c.get("userId");
    const conversationId = c.req.param("id");
    const conversation = await deps.db.query.conversations.findFirst({
      where: (t, { eq: e, and: a }) =>
        a(e(t.id, conversationId), e(t.userId, userId)),
    });
    if (!conversation) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Conversation not found" } },
        404,
      );
    }
    const row = await deps.db.query.sessionFeedback.findFirst({
      where: (t, { eq: e }) => e(t.conversationId, conversationId),
    });
    if (!row) {
      return c.json({ status: "missing" }); // /end wasn't called yet
    }
    return c.json({
      status: row.status,
      highlights: row.highlights,
      corrections: row.corrections,
      vocab: row.vocab,
    });
  });

  return routes;
}
```

`apps/api/src/routes/feedback.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createFeedbackRoutes } from "./feedback";

describe("feedback routes", () => {
  it("returns the feedback row when present", async () => {
    const deps = {
      db: {
        query: {
          conversations: {
            findFirst: vi.fn(async () => ({ id: "c1", userId: "u1" })),
          },
          sessionFeedback: {
            findFirst: vi.fn(async () => ({
              status: "ready",
              highlights: [{ phrase: "x", why: "y" }],
              corrections: [],
              vocab: [],
            })),
          },
        },
      } as any,
    };
    const app = new Hono<{ Variables: { userId: string } }>();
    app.use("*", async (c, next) => {
      c.set("userId", "u1");
      await next();
    });
    app.route("/v1", createFeedbackRoutes(deps));
    const res = await app.fetch(
      new Request("http://x/v1/sessions/c1/feedback"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ready");
  });

  it("404 when conversation isn't the user's", async () => {
    const deps = {
      db: {
        query: {
          conversations: { findFirst: vi.fn(async () => null) },
          sessionFeedback: { findFirst: vi.fn() },
        },
      } as any,
    };
    const app = new Hono<{ Variables: { userId: string } }>();
    app.use("*", async (c, next) => {
      c.set("userId", "u1");
      await next();
    });
    app.route("/v1", createFeedbackRoutes(deps));
    const res = await app.fetch(
      new Request("http://x/v1/sessions/c1/feedback"),
    );
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Mount in app.ts**

```ts
import { createFeedbackRoutes } from "./routes/feedback";
// in createApp(), under /v1/* middleware:
app.route("/v1", createFeedbackRoutes({ db }));
```

- [ ] **Step 3: Run tests, then commit**

```
cd apps/api && pnpm test src/routes/feedback.test.ts
```

```bash
git add apps/api/src/routes/feedback.ts apps/api/src/routes/feedback.test.ts apps/api/src/app.ts
git commit -m "$(cat <<'EOF'
feat(api): GET /v1/sessions/:id/feedback

Returns ready / pending / failed / missing. Plan 8 M2 Task 9.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### ✅ Milestone 2 Test Checkpoint

1. Build APK (`eas build --profile development --platform android`), install
2. Sign up new test user → onboarding → memory consent screen appears → tap Continue → home
3. Profile tab → "Coach's Memory" link visible → tap → see empty state (no memory yet)
4. Have a 3-min conversation, end
5. Pull `/v1/sessions/<id>/feedback` from a terminal with the user's Supabase JWT — expect `{ status: "pending" }` initially, `{ status: "ready", ...3 panels }` within ~10 sec
6. Reload Profile → Coach's Memory → see populated memory; edit a topic; save; verify the row updated in DB
7. Optional: opt out in onboarding; verify subsequent /end does NOT extract memory (check `coach_memory.opted_out=true`)

---

# Milestone 3 — End-of-session sheet + Role-play (Tasks 10–14)

**Goal:** End-of-session sheet renders the 3-panel feedback after every conversation; role-play picker offers 10 scenarios (3 free / 7 Pro).

---

### Task 10: End-of-session sheet UI

**Files:**

- Create: `apps/mobile/app/(modals)/end-of-session.tsx`
- Create: `apps/mobile/src/features/practice/use-session-feedback.ts`

- [ ] **Step 1: Feedback hook**

`apps/mobile/src/features/practice/use-session-feedback.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/src/lib/api-client";
import type { SessionFeedback } from "@language-coach/shared";

export type FeedbackResponse =
  | { status: "missing" }
  | { status: "pending" }
  | { status: "failed" }
  | ({ status: "ready" } & SessionFeedback);

export function useSessionFeedback(conversationId: string | null) {
  return useQuery<FeedbackResponse>({
    queryKey: ["session-feedback", conversationId],
    enabled: !!conversationId,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (data && data.status === "pending") return 1500;
      return false;
    },
    queryFn: async () => {
      const r = (await apiClient.get(
        `/v1/sessions/${conversationId}/feedback`,
      )) as FeedbackResponse;
      return r;
    },
  });
}
```

- [ ] **Step 2: End-of-session screen**

`apps/mobile/app/(modals)/end-of-session.tsx`:

```tsx
import {
  ScrollView,
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { EditorialText, Screen } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";
import { useSessionFeedback } from "@/src/features/practice/use-session-feedback";

export default function EndOfSessionScreen() {
  const { conversationId, secondsSpoken } = useLocalSearchParams<{
    conversationId: string;
    secondsSpoken?: string;
  }>();
  const { data } = useSessionFeedback(conversationId ?? null);

  const goHome = () => router.replace("/(tabs)/home");
  const again = () => router.replace("/(tabs)/practice");

  const seconds = secondsSpoken ? Number(secondsSpoken) : 0;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;

  return (
    <Screen variant="gradient">
      <ScrollView contentContainerStyle={styles.scroll}>
        <EditorialText kind="displayMd" italic style={styles.title}>
          Great job!
        </EditorialText>
        <EditorialText
          kind="bodyMd"
          color={palette.inkSoft}
          style={styles.subtitle}
        >
          You spoke for {min} min {sec} sec
        </EditorialText>

        {(!data || data.status === "pending") && (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.accent} />
            <EditorialText kind="bodyMd" color={palette.inkSoft}>
              Your coach is preparing feedback…
            </EditorialText>
          </View>
        )}

        {data?.status === "failed" && (
          <EditorialText
            kind="bodyMd"
            color={palette.inkSoft}
            style={styles.failed}
          >
            Couldn't generate feedback this session. No worries — try another
            conversation.
          </EditorialText>
        )}

        {data?.status === "ready" && (
          <>
            <Section title="✨ What you nailed">
              {data.highlights.length === 0 ? (
                <EditorialText kind="bodySm" color={palette.inkSoft}>
                  Plenty more next time.
                </EditorialText>
              ) : (
                data.highlights.map((h, i) => (
                  <Item key={i} top={h.phrase} bottom={h.why} />
                ))
              )}
            </Section>
            <Section title="📝 Things to polish">
              {data.corrections.length === 0 ? (
                <EditorialText kind="bodySm" color={palette.inkSoft}>
                  Nothing to fix — nice.
                </EditorialText>
              ) : (
                data.corrections.map((c, i) => (
                  <Item
                    key={i}
                    top={`You said "${c.you_said}"`}
                    middle={`Better: "${c.better}"`}
                    bottom={c.explanation}
                  />
                ))
              )}
            </Section>
            <Section title="📚 Worth remembering">
              {data.vocab.length === 0 ? (
                <EditorialText kind="bodySm" color={palette.inkSoft}>
                  No new vocab today.
                </EditorialText>
              ) : (
                data.vocab.map((v, i) => (
                  <Item
                    key={i}
                    top={`${v.term}  →  ${v.translation}`}
                    bottom={v.source_phrase ?? ""}
                  />
                ))
              )}
            </Section>
          </>
        )}

        <View style={styles.actions}>
          <Pressable onPress={again} style={[styles.btn, styles.btnSecondary]}>
            <EditorialText kind="bodyMd" color={palette.inkSoft}>
              Try another
            </EditorialText>
          </Pressable>
          <Pressable onPress={goHome} style={[styles.btn, styles.btnPrimary]}>
            <EditorialText kind="bodyMd" color={palette.peach}>
              Done
            </EditorialText>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <EditorialText kind="bodyMd" style={styles.sectionTitle}>
        {title}
      </EditorialText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Item({
  top,
  middle,
  bottom,
}: {
  top: string;
  middle?: string;
  bottom?: string;
}) {
  return (
    <View style={styles.item}>
      <EditorialText kind="bodyMd" style={styles.itemTop}>
        {top}
      </EditorialText>
      {middle && (
        <EditorialText kind="bodySm" color={palette.accent}>
          {middle}
        </EditorialText>
      )}
      {bottom && (
        <EditorialText kind="bodySm" color={palette.inkSoft}>
          {bottom}
        </EditorialText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, paddingBottom: spacing["3xl"] },
  title: { color: palette.ink },
  subtitle: { marginBottom: spacing.xl },
  loading: { gap: spacing.md, alignItems: "center", marginTop: spacing.xl },
  failed: { marginTop: spacing.xl },
  section: { marginTop: spacing.xl },
  sectionTitle: {
    fontWeight: "600",
    color: palette.ink,
    marginBottom: spacing.sm,
  },
  sectionBody: { gap: spacing.md },
  item: {
    backgroundColor: palette.glassStrong,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  itemTop: { color: palette.ink },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing["2xl"],
  },
  btn: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    ...shadow.cta,
  },
  btnPrimary: { backgroundColor: palette.ink },
  btnSecondary: { backgroundColor: palette.glassStrong },
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(modals)/end-of-session.tsx \
        apps/mobile/src/features/practice/use-session-feedback.ts
git commit -m "$(cat <<'EOF'
feat(mobile): end-of-session sheet (3-panel feedback)

Polls /v1/sessions/:id/feedback. Plan 8 M3 Task 10.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Wire end-of-session sheet from Practice tab

**Files:**

- Modify: `apps/mobile/app/(tabs)/practice.tsx`
- Modify: `apps/mobile/src/features/practice/use-conversation.ts` (if needed — to expose conversationId after end)

- [ ] **Step 1: Surface conversation_id from useConversation**

Read `apps/mobile/src/features/practice/use-conversation.ts` and verify it stores the conversation_id internally. If `end()` doesn't already return it, modify so that it returns `{ conversationId: string | null, secondsSpoken: number }` from the /end response.

- [ ] **Step 2: Replace `onExit` in practice.tsx**

Replace the `onExit` handler (currently lines ~135-165) with:

```tsx
const onExit = () => {
  Alert.alert("End conversation?", undefined, [
    { text: "Keep talking", style: "cancel" },
    {
      text: "End",
      style: "destructive",
      onPress: () => {
        void (async () => {
          let endResult: {
            conversationId: string | null;
            secondsSpoken: number;
          } | null = null;
          try {
            endResult = await end();
          } catch {
            /* best-effort */
          }
          resetSessionTimer();
          todaySecondsAtStartRef.current = 0;
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["today-stats"] }),
            queryClient.invalidateQueries({ queryKey: ["progress-summary"] }),
            queryClient.invalidateQueries({ queryKey: ["current-streak"] }),
          ]);
          if (endResult?.conversationId) {
            router.replace({
              pathname: "/(modals)/end-of-session",
              params: {
                conversationId: endResult.conversationId,
                secondsSpoken: String(endResult.secondsSpoken),
              },
            });
          } else {
            router.replace("/(tabs)/home");
          }
        })();
      },
    },
  ]);
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(tabs)/practice.tsx \
        apps/mobile/src/features/practice/use-conversation.ts
git commit -m "$(cat <<'EOF'
feat(mobile): practice.tsx routes to end-of-session sheet on exit

Plan 8 M3 Task 11.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Role-play scenarios catalog in shared

**Files:**

- Create: `packages/shared/src/role-play-scenarios.ts`
- Modify: `packages/shared/src/index.ts`
- Create: `packages/shared/src/role-play-scenarios.test.ts`

- [ ] **Step 1: Failing test**

```ts
// packages/shared/src/role-play-scenarios.test.ts
import { describe, expect, it } from "vitest";
import { ROLE_PLAY_SCENARIOS } from "./role-play-scenarios";

describe("ROLE_PLAY_SCENARIOS", () => {
  it("has exactly 10 scenarios", () => {
    expect(ROLE_PLAY_SCENARIOS).toHaveLength(10);
  });
  it("has exactly 3 free scenarios", () => {
    expect(ROLE_PLAY_SCENARIOS.filter((s) => !s.pro)).toHaveLength(3);
  });
  it("every scenario has a non-empty systemPromptFragment", () => {
    for (const s of ROLE_PLAY_SCENARIOS) {
      expect(s.systemPromptFragment.length).toBeGreaterThan(40);
    }
  });
  it("ids are unique", () => {
    const ids = ROLE_PLAY_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Implement**

`packages/shared/src/role-play-scenarios.ts`:

```ts
export type RolePlayScenario = {
  id: string;
  title: { en: string; fr: string };
  description: { en: string; fr: string };
  systemPromptFragment: string;
  pro: boolean;
};

export const ROLE_PLAY_SCENARIOS: RolePlayScenario[] = [
  {
    id: "coffee",
    title: {
      en: "Ordering coffee or food",
      fr: "Commander un café ou à manger",
    },
    description: {
      en: "At a small local café. Casual register.",
      fr: "Dans un petit café local. Registre familier.",
    },
    pro: false,
    systemPromptFragment:
      "Play the role of the barista at a small local café. Greet the student naturally. Take their order. Mid-conversation, introduce a twist: either the espresso machine is broken, the pastry they want is out, OR the card reader is down (pick one). Keep it natural and brief.",
  },
  {
    id: "directions",
    title: { en: "Asking for directions", fr: "Demander son chemin" },
    description: {
      en: "A stranger on the street. The student needs to find a landmark.",
      fr: "Un inconnu dans la rue. L'étudiant cherche un lieu connu.",
    },
    pro: false,
    systemPromptFragment:
      "Play the role of a friendly stranger the student stops on the street. They are trying to find a well-known landmark in your city. Give directions with a couple of landmarks (e.g., 'turn left at the bakery'). Be patient if they ask you to repeat. Optional twist: you don't actually know — suggest someone else.",
  },
  {
    id: "party",
    title: { en: "Small talk at a party", fr: "Conversation à une fête" },
    description: {
      en: "First meeting at a friend-of-a-friend's party.",
      fr: "Première rencontre à la fête d'un ami d'ami.",
    },
    pro: false,
    systemPromptFragment:
      "Play the role of another guest at a friend-of-a-friend's birthday party. Introduce yourself, ask how they know the host. Mid-conversation, find one thing in common (job, hobby, travel) and dig into it. Keep it light, casual register.",
  },
  {
    id: "hotel",
    title: { en: "Hotel check-in", fr: "Arrivée à l'hôtel" },
    description: {
      en: "Polite formal register. Reservation issue mid-way.",
      fr: "Registre poli. Problème de réservation à mi-parcours.",
    },
    pro: true,
    systemPromptFragment:
      "Play the role of a hotel receptionist. Greet the student formally, ask for their booking name, and present a small issue: their room isn't ready yet OR they were upgraded but it costs extra OR there's a noise complaint about a neighbor. Negotiate politely.",
  },
  {
    id: "doctor",
    title: { en: "Doctor visit", fr: "Chez le médecin" },
    description: {
      en: "Describing symptoms; understanding instructions for medication.",
      fr: "Décrire ses symptômes; comprendre les instructions pour un médicament.",
    },
    pro: true,
    systemPromptFragment:
      "Play the role of a kind GP. Ask the student what brings them in. Ask follow-up questions about symptoms (when it started, severity, prior episodes). Eventually give them a prescription and clear instructions (dosage, frequency, duration). Be patient with vocabulary.",
  },
  {
    id: "interview",
    title: { en: "Job interview", fr: "Entretien d'embauche" },
    description: {
      en: "Formal register; test how the student responds to a hard question.",
      fr: "Registre formel; tester comment l'étudiant répond à une question difficile.",
    },
    pro: true,
    systemPromptFragment:
      "Play the role of a hiring manager interviewing the student for a role in their field. After 2-3 friendly opening questions, ask ONE harder question (e.g., 'tell me about a failure', or 'why are you leaving your current job?') and follow up. Keep your turns short — let them talk.",
  },
  {
    id: "complaint",
    title: {
      en: "Customer-service complaint",
      fr: "Réclamation au service client",
    },
    description: {
      en: "Assertive register without being rude.",
      fr: "Registre assertif sans être impoli.",
    },
    pro: true,
    systemPromptFragment:
      "Play the role of a customer-service agent on the phone. The student has a complaint (defective product, late delivery, billing error — let them pick). Initially be slightly bureaucratic; if they advocate clearly, eventually offer a fair resolution. Keep it realistic, not theatrical.",
  },
  {
    id: "phone-friend",
    title: {
      en: "Phone call with a friend",
      fr: "Appel téléphonique avec un ami",
    },
    description: {
      en: "Casual, fast, contractions allowed.",
      fr: "Décontracté, rapide, contractions permises.",
    },
    pro: true,
    systemPromptFragment:
      "Play the role of a close friend the student hasn't spoken to in a few weeks. Catch up — what's new, what's coming up. Casual register, slang OK. Mention one small thing going on in your life that needs their advice.",
  },
  {
    id: "meeting",
    title: {
      en: "Workplace meeting intro",
      fr: "Présentation en réunion au travail",
    },
    description: {
      en: "Polite professional; the student introduces themselves to a new team.",
      fr: "Professionnel poli; l'étudiant se présente à une nouvelle équipe.",
    },
    pro: true,
    systemPromptFragment:
      "Play the role of a colleague chairing a meeting where the student is the new joiner. Invite them to introduce themselves, ask 1-2 friendly questions about their background, then ask them what they're looking forward to. Keep it brief and warm.",
  },
  {
    id: "emergency",
    title: {
      en: "Lost passport — police station",
      fr: "Passeport perdu — au commissariat",
    },
    description: {
      en: "Stressed formal register; following instructions under pressure.",
      fr: "Registre formel et stressé; suivre des instructions sous pression.",
    },
    pro: true,
    systemPromptFragment:
      "Play the role of a police officer at a station. The student has lost their passport while traveling. Ask the necessary questions (when, where, identifying details, hotel address), give them clear next steps (which embassy to contact, what documents to bring, fee). Keep tone professional.",
  },
];
```

Add `export * from "./role-play-scenarios";` to shared `index.ts`.

- [ ] **Step 3: Run tests + commit**

```
cd packages/shared && pnpm test src/role-play-scenarios.test.ts
```

```bash
git add packages/shared/src/role-play-scenarios.ts \
        packages/shared/src/role-play-scenarios.test.ts \
        packages/shared/src/index.ts
git commit -m "feat(shared): role-play scenarios catalog (10 scenarios, 3 free / 7 Pro)

Plan 8 M3 Task 12.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Role-play picker modal

**Files:**

- Create: `apps/mobile/app/(modals)/role-play-picker.tsx`
- Modify: `apps/mobile/app/(tabs)/practice.tsx` (add picker button)

- [ ] **Step 1: Picker modal**

`apps/mobile/app/(modals)/role-play-picker.tsx`:

```tsx
import { ScrollView, StyleSheet, View, Pressable } from "react-native";
import { router } from "expo-router";
import { ROLE_PLAY_SCENARIOS } from "@language-coach/shared";
import { EditorialText, Screen } from "@/src/design";
import { palette, radius, spacing } from "@language-coach/design-tokens";
import { usePurchases } from "@/src/features/paywall/use-purchases"; // safe placeholder; M4 makes it real
import { useProfile } from "@/src/features/auth/use-profile";

export default function RolePlayPicker() {
  const { isPro } = usePurchases();
  const { data: profile } = useProfile();
  const nativeLang = (profile?.native_lang ?? "en") as "en" | "fr";

  const onPick = (id: string, locked: boolean) => {
    if (locked) {
      router.push("/(modals)/paywall");
      return;
    }
    router.replace({
      pathname: "/(tabs)/practice",
      params: { scenarioId: id },
    });
  };

  return (
    <Screen variant="gradient">
      <ScrollView contentContainerStyle={styles.scroll}>
        <EditorialText kind="displayMd" italic style={styles.title}>
          Practice a scenario
        </EditorialText>
        <EditorialText
          kind="bodyMd"
          color={palette.inkSoft}
          style={styles.subtitle}
        >
          Pick a real-world situation. Your coach will play their role and throw
          in a twist.
        </EditorialText>
        {ROLE_PLAY_SCENARIOS.map((s) => {
          const locked = s.pro && !isPro;
          const title = s.title[nativeLang] ?? s.title.en;
          const desc = s.description[nativeLang] ?? s.description.en;
          return (
            <Pressable
              key={s.id}
              onPress={() => onPick(s.id, locked)}
              style={styles.row}
            >
              <View style={{ flex: 1 }}>
                <EditorialText kind="bodyMd" style={styles.rowTitle}>
                  {title} {locked ? "🔒" : ""}
                </EditorialText>
                <EditorialText kind="bodySm" color={palette.inkSoft}>
                  {desc}
                </EditorialText>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, gap: spacing.md },
  title: { color: palette.ink },
  subtitle: { marginBottom: spacing.lg },
  row: {
    backgroundColor: palette.glassStrong,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.sm,
  },
  rowTitle: { color: palette.ink, marginBottom: spacing.xs },
});
```

- [ ] **Step 2: Add picker entry from Practice**

In `apps/mobile/app/(tabs)/practice.tsx`, add a small "Practice a scenario" link/button. Best placement: in `TopStatusBar`'s right side, or above the mic. Keep minimal:

```tsx
<Pressable
  onPress={() => router.push("/(modals)/role-play-picker")}
  style={styles.scenarioLink}
>
  <EditorialText kind="bodySm" color={palette.inkSoft}>
    Try a scenario
  </EditorialText>
</Pressable>
```

(Add `scenarioLink: { padding: spacing.sm, alignSelf: "center" }` to styles.)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(modals)/role-play-picker.tsx \
        apps/mobile/app/(tabs)/practice.tsx
git commit -m "feat(mobile): role-play picker modal + practice tab entry

Plan 8 M3 Task 13.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Scenario integration in voice routes

**Files:**

- Modify: `apps/api/src/routes/voice.ts` (POST /sessions accepts scenarioId; /turns injects scenario into prompt)

- [ ] **Step 1: Extend StartSessionBody**

In `voice.ts` near line 42, replace `StartSessionBody`:

```ts
import { ROLE_PLAY_SCENARIOS } from "@language-coach/shared";

const StartSessionBody = z.object({
  language: z.string().min(2).max(8),
  topic_id: z.string().uuid().optional(),
  scenario_id: z
    .enum(ROLE_PLAY_SCENARIOS.map((s) => s.id) as [string, ...string[]])
    .optional(),
});
```

- [ ] **Step 2: Store scenario_id on the conversation**

For v1 simplicity, add a `scenario_id text` column to `conversations` via a small migration. Skip if you'd rather pass `scenario_id` via session params — easier path is to add to schema. Quick migration:

`apps/api/src/db/migrations/0011a_conversations_scenario.sql`:

```sql
ALTER TABLE conversations ADD COLUMN scenario_id text;
```

Add `scenarioId: text("scenario_id")` to `apps/api/src/db/schema/conversations.ts`.

In the `/sessions` POST handler, when inserting the conversation, set `scenarioId: parsed.data.scenario_id ?? null`.

- [ ] **Step 3: Inject scenario in /turns**

In `/sessions/:id/turns`, AFTER loading `conversation`, look up the scenario:

```ts
import { ROLE_PLAY_SCENARIOS } from "@language-coach/shared";
// ...
const scenario = conversation.scenarioId
  ? (ROLE_PLAY_SCENARIOS.find((s) => s.id === conversation.scenarioId) ?? null)
  : null;
const scenarioFragment = scenario
  ? {
      id: scenario.id,
      systemPromptFragment: scenario.systemPromptFragment,
    }
  : null;
const sysPrompt = buildCoachSystemPrompt({
  targetLanguage: conversation.language,
  userDisplayName: profile.displayName,
  memory,
  memoryDepth,
  scenario: scenarioFragment,
});
```

- [ ] **Step 4: Run all api tests, commit**

```
cd apps/api && pnpm db:migrate && pnpm test
```

```bash
git add apps/api/src/routes/voice.ts \
        apps/api/src/db/schema/conversations.ts \
        apps/api/src/db/migrations/0011a_conversations_scenario.sql
git commit -m "feat(api): scenario_id on conversations + system prompt injection

Plan 8 M3 Task 14.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### ✅ Milestone 3 Test Checkpoint

1. Build APK, install
2. Open practice → tap "Try a scenario" → see 10 scenarios (3 unlocked / 7 locked)
3. Pick "Ordering coffee" → conversation starts with coach playing barista
4. Talk for 3 minutes, end → end-of-session sheet renders with 3 panels populated
5. Tap "Try another" → goes back to practice
6. Pick a locked scenario → paywall modal opens (still placeholder in M3; M4 makes it real)

---

# Milestone 4 — Freemium gating + Paywall (Tasks 15–19)

**Goal:** Free vs Pro is enforced server-side; mobile paywall is wired; sandbox subscribe flips the entitlement.

---

### Task 15: lib/features.ts module

**Files:**

- Create: `apps/api/src/lib/features.ts` + `.test.ts`

- [ ] **Step 1: Failing test**

```ts
// apps/api/src/lib/features.test.ts
import { describe, expect, it, vi } from "vitest";
import { canUseFeature, FEATURES } from "./features";

const mkDb = (entitlement: any) =>
  ({
    query: {
      entitlements: { findFirst: vi.fn(async () => entitlement) },
    },
  }) as any;

describe("canUseFeature", () => {
  it("returns false for free plan on Pro feature", async () => {
    const db = mkDb({ plan: "free", proUntil: null });
    expect(await canUseFeature("u1", FEATURES.COACH_MEMORY_DEEP, { db })).toBe(
      false,
    );
  });
  it("returns true for active Pro plan", async () => {
    const future = new Date(Date.now() + 7 * 86400 * 1000);
    const db = mkDb({ plan: "pro", proUntil: future });
    expect(await canUseFeature("u1", FEATURES.COACH_MEMORY_DEEP, { db })).toBe(
      true,
    );
  });
  it("returns false when Pro plan is expired", async () => {
    const past = new Date(Date.now() - 86400 * 1000);
    const db = mkDb({ plan: "pro", proUntil: past });
    expect(await canUseFeature("u1", FEATURES.COACH_MEMORY_DEEP, { db })).toBe(
      false,
    );
  });
  it("returns false when no entitlement row exists", async () => {
    const db = mkDb(null);
    expect(await canUseFeature("u1", FEATURES.COACH_MEMORY_DEEP, { db })).toBe(
      false,
    );
  });
});
```

- [ ] **Step 2: Implement**

```ts
// apps/api/src/lib/features.ts
import type { Database } from "../db";

export const FEATURES = {
  COACH_MEMORY_DEEP: "coach_memory_deep",
  FEEDBACK_HISTORY: "feedback_history",
  FEEDBACK_AUDIO: "feedback_audio",
  ROLEPLAY_PREMIUM: "roleplay_premium",
  WEEKLY_DIGEST_EMAIL: "weekly_digest_email",
} as const;

export type Feature = (typeof FEATURES)[keyof typeof FEATURES];

export type FeatureDeps = { db: Database };

export async function canUseFeature(
  userId: string,
  feature: Feature,
  deps: FeatureDeps,
): Promise<boolean> {
  const ent = await deps.db.query.entitlements.findFirst({
    where: (t: any, { eq: e }: any) => e(t.userId, userId),
  });
  if (!ent) return false;
  if (ent.plan !== "pro") return false;
  if (!ent.proUntil || new Date(ent.proUntil) <= new Date()) return false;
  // All listed features are Pro-only; no per-feature toggling yet.
  void feature;
  return true;
}
```

- [ ] **Step 3: Run tests, commit**

```bash
git add apps/api/src/lib/features.ts apps/api/src/lib/features.test.ts
git commit -m "feat(api): canUseFeature module

Plan 8 M4 Task 15.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Daily voice quota

**Files:**

- Create: `apps/api/src/db/migrations/0012_entitlements_daily_quota.sql`
- Modify: `apps/api/src/db/schema/entitlements.ts`
- Modify: `apps/api/src/lib/quota.ts` + `.test.ts`
- Modify: `apps/api/src/env.ts`
- Modify: `apps/api/src/routes/voice.ts` (use new quota in /turns)

- [ ] **Step 1: SQL migration**

`0012_entitlements_daily_quota.sql`:

```sql
ALTER TABLE entitlements
  ADD COLUMN daily_voice_seconds_used integer NOT NULL DEFAULT 0,
  ADD COLUMN daily_reset_at timestamptz NOT NULL DEFAULT now();
```

- [ ] **Step 2: Update Drizzle schema**

In `entitlements.ts`, add:

```ts
dailyVoiceSecondsUsed: integer("daily_voice_seconds_used").notNull().default(0),
dailyResetAt: timestamp("daily_reset_at", { withTimezone: true }).notNull(),
```

- [ ] **Step 3: Extend quota.ts**

```ts
// add to apps/api/src/lib/quota.ts
import {
  FREE_TIER_VOICE_SECONDS_PER_DAY,
  PRO_TIER_VOICE_SECONDS_PER_DAY_SOFT_CAP,
} from "../env";

export type DailyEntitlement = {
  plan: "free" | "pro";
  proUntil: Date | null;
  dailyVoiceSecondsUsed: number;
  dailyResetAt: Date;
};

export type CanUseDailyResult =
  | { allowed: true; warnSoftCap?: boolean }
  | { allowed: false; reason: "DAILY_QUOTA_EXCEEDED"; resetAt: Date };

export function canUseSecondsDaily(
  entitlement: DailyEntitlement,
  estimatedSeconds: number,
  nowOverride?: Date,
): CanUseDailyResult {
  const now = nowOverride ?? new Date();
  // If reset window has passed, treat dailyVoiceSecondsUsed as 0
  const used =
    entitlement.dailyResetAt.getTime() + 24 * 60 * 60 * 1000 < now.getTime()
      ? 0
      : entitlement.dailyVoiceSecondsUsed;
  const wouldUse = used + estimatedSeconds;

  const isPro =
    entitlement.plan === "pro" &&
    entitlement.proUntil !== null &&
    entitlement.proUntil > now;

  if (isPro) {
    const cap = PRO_TIER_VOICE_SECONDS_PER_DAY_SOFT_CAP;
    if (wouldUse <= cap) return { allowed: true };
    return { allowed: true, warnSoftCap: true }; // soft cap: still allow
  }

  if (wouldUse <= FREE_TIER_VOICE_SECONDS_PER_DAY) return { allowed: true };
  const resetAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return { allowed: false, reason: "DAILY_QUOTA_EXCEEDED", resetAt };
}
```

Add to `env.ts`:

```ts
FREE_TIER_VOICE_SECONDS_PER_DAY: 600,   // 10 min
PRO_TIER_VOICE_SECONDS_PER_DAY_SOFT_CAP: 3600, // 60 min
```

(Or via existing env-loading pattern — check current `env.ts`.)

- [ ] **Step 4: Use new quota in voice.ts /turns**

In `/sessions/:id/turns`, REPLACE the existing `canUseSeconds(...)` block with:

```ts
const dailyCheck = canUseSecondsDaily(
  {
    plan: entitlement.plan as "free" | "pro",
    proUntil: entitlement.proUntil,
    dailyVoiceSecondsUsed: entitlement.dailyVoiceSecondsUsed,
    dailyResetAt: entitlement.dailyResetAt,
  },
  estimateSeconds,
);
if (!dailyCheck.allowed) {
  return c.json(
    {
      error: {
        code: "DAILY_QUOTA_EXCEEDED",
        message: "Free tier daily limit reached",
        resetAt: dailyCheck.resetAt.toISOString(),
      },
    },
    429,
  );
}
```

And ALSO update the entitlement increment at the end of the handler:

```ts
await deps.db
  .update(entitlements)
  .set({
    monthlyVoiceSecondsUsed:
      entitlement.monthlyVoiceSecondsUsed + secondsThisTurn,
    dailyVoiceSecondsUsed:
      (entitlement.dailyResetAt.getTime() + 86400000 < Date.now()
        ? 0
        : entitlement.dailyVoiceSecondsUsed) + secondsThisTurn,
    dailyResetAt:
      entitlement.dailyResetAt.getTime() + 86400000 < Date.now()
        ? new Date()
        : entitlement.dailyResetAt,
  })
  .where(eq(entitlements.userId, userId));
```

- [ ] **Step 5: Run migrations + tests, commit**

```
cd apps/api && pnpm db:migrate && pnpm test
```

```bash
git add apps/api/src/db/migrations/0012_entitlements_daily_quota.sql \
        apps/api/src/db/schema/entitlements.ts \
        apps/api/src/lib/quota.ts apps/api/src/lib/quota.test.ts \
        apps/api/src/env.ts apps/api/src/routes/voice.ts
git commit -m "feat(api): daily voice quota (free 10min/day, Pro 60min soft cap)

Plan 8 M4 Task 16.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 17: RevenueCat dashboard setup (manual, ~30 min)

**Not code — instructions for Bruno.**

- [ ] **Step 1: Create RevenueCat project**

1. Sign in at https://app.revenuecat.com (use your existing Google account)
2. Create project "My Language Coach"

- [ ] **Step 2: Connect Google Play**

1. Project Settings → Apps → Add → Google Play
2. App package name: `com.anonymous.mylanguagecoach` (verify in `apps/mobile/app.config.ts`)
3. Upload the service-account JSON (the one you generated earlier for `eas submit`)

- [ ] **Step 3: Define products**

In Google Play Console (Monetize → Subscriptions):

- Create subscription `mlc_pro_monthly`: $7.99/mo, 7-day free trial, base plan ID `monthly-auto-renewing`
- Create subscription `mlc_pro_annual`: $49.99/yr, 7-day free trial, base plan ID `annual-auto-renewing`

In RevenueCat:

- Products tab → Add both subscription IDs from Play Console
- Entitlements tab → create entitlement `pro` → attach both products

- [ ] **Step 4: Get the public SDK key**

RevenueCat → Project Settings → API Keys → Android → copy the **Public SDK Key** (`goog_...`). Save it as `apps/mobile/.env` `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_...`. Add to `apps/mobile/app.config.ts` `extra`.

- [ ] **Step 5: Configure webhook**

RevenueCat → Project Settings → Integrations → Webhooks. URL: `https://my-language-coach-agentical-rebuild.fly.dev/v1/billing/revenuecat`. Generate an "Authorization header" secret; copy it. Store as `flyctl secrets set REVENUECAT_WEBHOOK_SECRET=<value>`. Also save to `apps/api/.env`.

- [ ] **Step 6: Done — verify by hitting the API**

Once API is deployed with Task 19's webhook live, click "Send Test Event" in RevenueCat. The API should respond 200; visible in Fly logs.

---

### Task 18: react-native-purchases integration + paywall modal

**Files:**

- Modify: `apps/mobile/package.json` (add dep)
- Modify: `apps/mobile/app/_layout.tsx` (initialize SDK)
- Create: `apps/mobile/src/features/paywall/use-purchases.ts`
- Create: `apps/mobile/app/(modals)/paywall.tsx`

- [ ] **Step 1: Install dep**

```
cd apps/mobile && npx expo install react-native-purchases
cd ../.. && pnpm install
```

(Critical: `pnpm install` after `npx expo install` per the saved feedback memory; without it, the EAS APK ships without the native binary.)

- [ ] **Step 2: Initialize SDK in root layout**

In `apps/mobile/app/_layout.tsx`, near other init code, add:

```tsx
import Purchases from "react-native-purchases";
import { Platform } from "react-native";
import Constants from "expo-constants";

const REVENUECAT_KEY =
  Constants.expoConfig?.extra?.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";

// once on app start
useEffect(() => {
  if (Platform.OS === "android" && REVENUECAT_KEY) {
    Purchases.configure({ apiKey: REVENUECAT_KEY });
  }
}, []);
```

Identify the user once Supabase auth resolves:

```ts
useEffect(() => {
  if (session?.user?.id) {
    void Purchases.logIn(session.user.id).catch(() => {});
  }
}, [session?.user?.id]);
```

- [ ] **Step 3: usePurchases hook**

`apps/mobile/src/features/paywall/use-purchases.ts`:

```ts
import { useEffect, useState, useCallback } from "react";
import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
} from "react-native-purchases";

export function usePurchases() {
  const [info, setInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ci = await Purchases.getCustomerInfo();
        if (!cancelled) setInfo(ci);
        const offs = await Purchases.getOfferings();
        if (!cancelled) setOfferings(offs.current);
      } catch {
        // SDK not configured; user can still browse free features
      }
    })();
    const sub = Purchases.addCustomerInfoUpdateListener((ci) => setInfo(ci));
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const isPro = !!info?.entitlements.active.pro;

  const purchase = useCallback(
    async (packageId: "monthly" | "annual") => {
      if (!offerings) throw new Error("no_offerings");
      const pkg =
        packageId === "monthly" ? offerings.monthly : offerings.annual;
      if (!pkg) throw new Error("package_not_found");
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      setInfo(customerInfo);
    },
    [offerings],
  );

  const restore = useCallback(async () => {
    const ci = await Purchases.restorePurchases();
    setInfo(ci);
  }, []);

  return { isPro, offerings, purchase, restore };
}
```

- [ ] **Step 4: Paywall modal**

`apps/mobile/app/(modals)/paywall.tsx`:

```tsx
import { useState } from "react";
import { StyleSheet, View, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { EditorialText, Screen } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";
import { usePurchases } from "@/src/features/paywall/use-purchases";

const FEATURES_LIST = [
  "Memory that remembers you across sessions",
  "Full feedback history for every conversation",
  "All 10 role-play scenarios",
  "60 min/day soft cap (vs 10 min on free)",
];

export default function PaywallModal() {
  const { offerings, purchase, restore } = usePurchases();
  const [busy, setBusy] = useState<"monthly" | "annual" | null>(null);

  const onPurchase = async (kind: "monthly" | "annual") => {
    setBusy(kind);
    try {
      await purchase(kind);
      Alert.alert("Welcome to Pro!", "Your features are unlocked.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      const msg = String(e);
      if (!msg.includes("cancelled") && !msg.includes("Cancel")) {
        Alert.alert("Purchase failed", msg);
      }
    } finally {
      setBusy(null);
    }
  };

  const onRestore = async () => {
    try {
      await restore();
      Alert.alert("Restored", "Your purchases have been restored.");
    } catch (e) {
      Alert.alert("Couldn't restore", String(e));
    }
  };

  const monthly = offerings?.monthly?.product;
  const annual = offerings?.annual?.product;

  return (
    <Screen variant="gradient">
      <View style={styles.container}>
        <EditorialText kind="displayMd" italic style={styles.title}>
          Unlock your coach
        </EditorialText>
        <View style={styles.bullets}>
          {FEATURES_LIST.map((f) => (
            <EditorialText
              key={f}
              kind="bodyMd"
              color={palette.ink}
              style={styles.bullet}
            >
              • {f}
            </EditorialText>
          ))}
        </View>
        <Pressable
          onPress={() => onPurchase("annual")}
          style={[styles.btnAnnual, busy === "annual" && styles.busy]}
          disabled={!!busy}
        >
          <EditorialText kind="bodyMd" color={palette.peach}>
            Annual {annual ? `— ${annual.priceString}/yr` : ""} · save 48%
          </EditorialText>
        </Pressable>
        <Pressable
          onPress={() => onPurchase("monthly")}
          style={[styles.btnMonthly, busy === "monthly" && styles.busy]}
          disabled={!!busy}
        >
          <EditorialText kind="bodyMd" color={palette.ink}>
            Monthly {monthly ? `— ${monthly.priceString}/mo` : ""}
          </EditorialText>
        </Pressable>
        <EditorialText
          kind="bodySm"
          color={palette.inkSoft}
          style={styles.fineprint}
        >
          7-day free trial. Cancel anytime in Google Play settings.
        </EditorialText>
        <Pressable onPress={onRestore} style={styles.restore}>
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            Restore purchases
          </EditorialText>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.close}>
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            Maybe later
          </EditorialText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, justifyContent: "center" },
  title: { color: palette.ink, marginBottom: spacing.xl },
  bullets: { gap: spacing.sm, marginBottom: spacing.xl },
  bullet: {},
  btnAnnual: {
    backgroundColor: palette.ink,
    borderRadius: radius.lg,
    padding: spacing.base,
    alignItems: "center",
    marginBottom: spacing.md,
    ...shadow.cta,
  },
  btnMonthly: {
    backgroundColor: palette.glassStrong,
    borderRadius: radius.lg,
    padding: spacing.base,
    alignItems: "center",
  },
  busy: { opacity: 0.6 },
  fineprint: { textAlign: "center", marginTop: spacing.md },
  restore: { marginTop: spacing.md, alignItems: "center" },
  close: { marginTop: spacing.sm, alignItems: "center" },
});
```

- [ ] **Step 5: Trigger paywall on DAILY_QUOTA_EXCEEDED + locked features**

In `apps/mobile/src/lib/api-client.ts` (or the appropriate error handler), when a request returns `DAILY_QUOTA_EXCEEDED`, navigate to `/(modals)/paywall`. (One place: in `use-conversation.ts`'s error branch.)

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/package.json apps/mobile/app/_layout.tsx \
        apps/mobile/src/features/paywall/use-purchases.ts \
        apps/mobile/app/(modals)/paywall.tsx \
        apps/mobile/src/lib/api-client.ts \
        apps/mobile/src/features/practice/use-conversation.ts
git commit -m "feat(mobile): RevenueCat + paywall modal

Plan 8 M4 Task 18.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 19: RevenueCat webhook endpoint

**Files:**

- Create: `apps/api/src/routes/billing.ts` + `.test.ts`
- Create: `apps/api/src/lib/revenuecat-webhook.ts` + `.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/env.ts` (add REVENUECAT_WEBHOOK_SECRET)

- [ ] **Step 1: Webhook handler**

`apps/api/src/lib/revenuecat-webhook.ts`:

```ts
import { z } from "zod";
import { eq } from "drizzle-orm";
import { entitlements } from "../db/schema";
import type { Database } from "../db";

export const RevenueCatEventSchema = z.object({
  event: z.object({
    type: z.string(),
    app_user_id: z.string(),
    expiration_at_ms: z.number().nullable().optional(),
    product_id: z.string().optional(),
  }),
});

export type RevenueCatEvent = z.infer<typeof RevenueCatEventSchema>;

const ACTIVATING = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
  "UNCANCELLATION",
]);
const DEACTIVATING = new Set([
  "CANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
  "SUBSCRIBER_ALIAS",
]);

export async function applyRevenueCatEvent(
  db: Database,
  event: RevenueCatEvent["event"],
): Promise<void> {
  const userId = event.app_user_id;
  if (!userId) return;
  if (ACTIVATING.has(event.type)) {
    const expiresAt = event.expiration_at_ms
      ? new Date(event.expiration_at_ms)
      : new Date(Date.now() + 31 * 86400 * 1000); // safety default
    await db
      .update(entitlements)
      .set({ plan: "pro", proUntil: expiresAt })
      .where(eq(entitlements.userId, userId));
    return;
  }
  if (DEACTIVATING.has(event.type)) {
    await db
      .update(entitlements)
      .set({ plan: "free", proUntil: null })
      .where(eq(entitlements.userId, userId));
    return;
  }
  // Other event types (TEST, NON_RENEWING_PURCHASE) are no-ops for now.
}
```

- [ ] **Step 2: Route**

`apps/api/src/routes/billing.ts`:

```ts
import { Hono } from "hono";
import {
  RevenueCatEventSchema,
  applyRevenueCatEvent,
} from "../lib/revenuecat-webhook";
import type { Database } from "../db";

export type BillingDeps = {
  db: Database;
  webhookSecret: string;
};

export function createBillingRoutes(deps: BillingDeps) {
  const routes = new Hono();

  routes.post("/revenuecat", async (c) => {
    const auth = c.req.header("Authorization");
    if (!auth || auth !== `Bearer ${deps.webhookSecret}`) {
      return c.json({ error: { code: "UNAUTHORIZED" } }, 401);
    }
    const raw = await c.req.json().catch(() => null);
    const parsed = RevenueCatEventSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json({ error: { code: "BAD_REQUEST" } }, 400);
    }
    try {
      await applyRevenueCatEvent(deps.db, parsed.data.event);
    } catch (e) {
      return c.json({ error: { code: "INTERNAL" } }, 500);
    }
    return c.json({ ok: true });
  });

  return routes;
}
```

- [ ] **Step 3: Mount + secrets**

`app.ts`:

```ts
import { createBillingRoutes } from "./routes/billing";
// outside the /v1/* auth middleware (RevenueCat is unauthenticated; uses the bearer secret)
app.route(
  "/v1/billing",
  createBillingRoutes({ db, webhookSecret: env.REVENUECAT_WEBHOOK_SECRET }),
);
```

Add `REVENUECAT_WEBHOOK_SECRET: z.string().min(20)` to env zod schema.

- [ ] **Step 4: Tests**

`revenuecat-webhook.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { applyRevenueCatEvent } from "./revenuecat-webhook";

describe("applyRevenueCatEvent", () => {
  it("upgrades on INITIAL_PURCHASE", async () => {
    const update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) }));
    const db = { update } as any;
    await applyRevenueCatEvent(db, {
      type: "INITIAL_PURCHASE",
      app_user_id: "u1",
      expiration_at_ms: Date.now() + 86400000,
    });
    expect(update).toHaveBeenCalled();
  });
  it("downgrades on CANCELLATION", async () => {
    const update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) }));
    const db = { update } as any;
    await applyRevenueCatEvent(db, {
      type: "CANCELLATION",
      app_user_id: "u1",
    });
    expect(update).toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/billing.ts apps/api/src/routes/billing.test.ts \
        apps/api/src/lib/revenuecat-webhook.ts apps/api/src/lib/revenuecat-webhook.test.ts \
        apps/api/src/app.ts apps/api/src/env.ts
git commit -m "feat(api): RevenueCat webhook + entitlement upserts

Plan 8 M4 Task 19.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### ✅ Milestone 4 Test Checkpoint

1. Manually toggle a test user to `plan='pro'` via SQL → reload app → verify locked scenarios + deep memory unlock
2. Toggle back to free → talk for 11 minutes → expect paywall on next turn
3. In Play Console: add yourself as a license tester. Build APK with the RevenueCat key wired.
4. Open paywall → sandbox-subscribe → verify webhook fires → DB shows `plan='pro'`
5. Cancel subscription in Play Console → webhook fires → DB flips back to free

---

# Milestone 5 — Push + Weekly summary + Store submission (Tasks 20–23)

**Goal:** Day 1/2/7 push notifications, Weekly summary screen, internal-track build live on Play Console.

---

### Task 20: push_schedule schema + migration

**Files:**

- Create: `apps/api/src/db/migrations/0013_push_schedule.sql`
- Create: `apps/api/src/db/schema/push-schedule.ts`
- Modify: `apps/api/src/db/schema/index.ts`

- [ ] **Step 1: SQL**

```sql
-- 0013_push_schedule.sql
CREATE TABLE push_schedule (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
  kind         text NOT NULL,
  send_at      timestamptz NOT NULL,
  sent_at      timestamptz,
  cancelled_at timestamptz,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX push_schedule_send_at_idx ON push_schedule (send_at)
  WHERE sent_at IS NULL AND cancelled_at IS NULL;

ALTER TABLE push_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "push_schedule_select_own" ON push_schedule
  FOR SELECT USING (auth.uid() = user_id);
-- Writes are service-role only (no RLS policy for insert/update/delete).
```

- [ ] **Step 2: Drizzle schema**

```ts
// push-schedule.ts
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

export const pushSchedule = pgTable(
  "push_schedule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.userId, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    payload: jsonb("payload").notNull().default({}),
  },
  (t) => ({
    sendAtIdx: index("push_schedule_send_at_idx").on(t.sendAt),
  }),
);

export type PushScheduleRow = typeof pushSchedule.$inferSelect;
export type NewPushScheduleRow = typeof pushSchedule.$inferInsert;
```

- [ ] **Step 3: Commit**

```
cd apps/api && pnpm db:migrate
```

```bash
git add apps/api/src/db/migrations/0013_push_schedule.sql \
        apps/api/src/db/schema/push-schedule.ts \
        apps/api/src/db/schema/index.ts
git commit -m "feat(api): push_schedule table

Plan 8 M5 Task 20.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 21: Push scheduler — write at signup, send via runner

**Files:**

- Create: `apps/api/src/lib/push-scheduler.ts` + `.test.ts`
- Create: `apps/api/src/jobs/push-runner.ts`
- Modify: `apps/api/src/index.ts` (start runner on boot)

This task creates the Day 1/2/7 schedule rows at signup (or on first call after signup) and runs a poller every 60s that sends due notifications via Expo Push.

- [ ] **Step 1: Scheduler helpers**

`apps/api/src/lib/push-scheduler.ts`:

```ts
import { eq, and, isNull, lte } from "drizzle-orm";
import { pushSchedule, pushTokens } from "../db/schema";
import type { Database } from "../db";

export type PushKind = "day-1-feedback" | "day-2-warmup" | "day-7-summary";

export type SchedulePushInput = {
  userId: string;
  kind: PushKind;
  sendAt: Date;
  payload?: Record<string, unknown>;
};

export async function schedulePush(
  db: Database,
  input: SchedulePushInput,
): Promise<void> {
  await db.insert(pushSchedule).values({
    userId: input.userId,
    kind: input.kind,
    sendAt: input.sendAt,
    payload: input.payload ?? {},
  });
}

export function computeDay1At(now: Date, tz: string): Date {
  // Approx 9am local time the day after `now`
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  // Best-effort: tomorrow at 09:00 local. We'll store UTC.
  const local = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(tomorrow);
  const y = +local.find((p) => p.type === "year")!.value;
  const m = +local.find((p) => p.type === "month")!.value;
  const d = +local.find((p) => p.type === "day")!.value;
  // 09:00 local — naive UTC conversion via toLocaleString trick
  const localDate = new Date(
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}T09:00:00`,
  );
  return localDate;
}

export async function scheduleOnboardingPushes(
  db: Database,
  userId: string,
  timezone: string,
): Promise<void> {
  const now = new Date();
  const day1 = computeDay1At(now, timezone);
  const day2 = new Date(day1.getTime() + 86400000 + 10 * 3600 * 1000); // ~7pm next day
  const day7 = new Date(day1.getTime() + 6 * 86400000 + 9 * 3600 * 1000); // ~6pm day 7

  await Promise.all([
    schedulePush(db, { userId, kind: "day-1-feedback", sendAt: day1 }),
    schedulePush(db, { userId, kind: "day-2-warmup", sendAt: day2 }),
    schedulePush(db, { userId, kind: "day-7-summary", sendAt: day7 }),
  ]);
}

export type DuePush = {
  id: string;
  userId: string;
  kind: PushKind;
  payload: Record<string, unknown>;
};

export async function pickDuePushes(
  db: Database,
  now: Date,
  limit = 50,
): Promise<DuePush[]> {
  const rows = await db
    .select({
      id: pushSchedule.id,
      userId: pushSchedule.userId,
      kind: pushSchedule.kind,
      payload: pushSchedule.payload,
    })
    .from(pushSchedule)
    .where(
      and(
        isNull(pushSchedule.sentAt),
        isNull(pushSchedule.cancelledAt),
        lte(pushSchedule.sendAt, now),
      ),
    )
    .limit(limit);
  return rows as DuePush[];
}

export async function markSent(db: Database, id: string): Promise<void> {
  await db
    .update(pushSchedule)
    .set({ sentAt: new Date() })
    .where(eq(pushSchedule.id, id));
}

export function bodyFor(kind: PushKind): {
  title: string;
  body: string;
  data?: any;
} {
  switch (kind) {
    case "day-1-feedback":
      return {
        title: "Your first feedback report is ready",
        body: "Your coach has notes from yesterday's session. Take a look.",
        data: { url: "mylanguagecoach://practice" },
      };
    case "day-2-warmup":
      return {
        title: "5 minutes with your coach?",
        body: "A quick warmup keeps the streak alive.",
        data: { url: "mylanguagecoach://practice" },
      };
    case "day-7-summary":
      return {
        title: "Your first week with your coach",
        body: "See your progress so far.",
        data: { url: "mylanguagecoach://weekly-summary" },
      };
  }
}
```

- [ ] **Step 2: Wire schedule on profile creation**

Wherever `complete_onboarding` happens (RPC or backend insert), after the row is inserted call `scheduleOnboardingPushes(db, userId, profile.timezone)`. If onboarding RPC is purely SQL, expose a new POST endpoint `/v1/profile/post-onboarding-hooks` that the mobile calls right after onboarding completes. Use the simpler path that exists.

- [ ] **Step 3: Runner**

`apps/api/src/jobs/push-runner.ts`:

```ts
import {
  pickDuePushes,
  markSent,
  bodyFor,
  type DuePush,
} from "../lib/push-scheduler";
import { pushTokens } from "../db/schema";
import { eq } from "drizzle-orm";
import type { Database } from "../db";

export function startPushRunner(db: Database, intervalMs = 60_000) {
  const tick = async () => {
    try {
      const due = await pickDuePushes(db, new Date());
      for (const p of due) {
        await trySend(db, p);
      }
    } catch (err) {
      console.error("push-runner tick failed", err);
    }
  };
  void tick();
  return setInterval(tick, intervalMs);
}

async function trySend(db: Database, p: DuePush) {
  const tokens = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .where(eq(pushTokens.userId, p.userId));
  if (tokens.length === 0) {
    await markSent(db, p.id);
    return;
  }
  const { title, body, data } = bodyFor(p.kind);
  await Promise.all(
    tokens.map((t) =>
      fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: t.token, title, body, data }),
      }).catch(() => {}),
    ),
  );
  await markSent(db, p.id);
}
```

In `apps/api/src/index.ts` (entry point), start the runner after the app boots:

```ts
import { startPushRunner } from "./jobs/push-runner";
// after createApp & after server start:
startPushRunner(db);
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/lib/push-scheduler.ts apps/api/src/lib/push-scheduler.test.ts \
        apps/api/src/jobs/push-runner.ts apps/api/src/index.ts
git commit -m "feat(api): push scheduler + Day 1/2/7 runner

Plan 8 M5 Task 21.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 22: Weekly summary screen

**Files:**

- Create: `apps/mobile/app/(tabs)/progress/weekly-summary.tsx`
- Modify: `apps/mobile/app/(tabs)/progress.tsx` (link to it; show top stats inline)
- Create: `apps/api/src/routes/weekly-summary.ts` + `.test.ts` (one endpoint to fetch the aggregate)
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Endpoint**

`apps/api/src/routes/weekly-summary.ts`:

```ts
import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { Database } from "../db";

export type WeeklySummaryDeps = { db: Database };

export function createWeeklySummaryRoutes(deps: WeeklySummaryDeps) {
  const routes = new Hono<{ Variables: { userId: string } }>();

  routes.get("/weekly-summary", async (c) => {
    const userId = c.get("userId");
    const rows = await deps.db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE ended_at IS NOT NULL) AS session_count,
        COALESCE(SUM(seconds_spoken), 0)::int AS total_seconds,
        COUNT(DISTINCT language) AS languages_practiced
      FROM conversations
      WHERE user_id = ${userId}
        AND started_at >= now() - interval '7 days'
    `);
    const row = rows[0] as any;
    return c.json({
      session_count: Number(row.session_count ?? 0),
      total_seconds: Number(row.total_seconds ?? 0),
      languages_practiced: Number(row.languages_practiced ?? 0),
    });
  });

  return routes;
}
```

Mount as `/v1/progress/weekly-summary` under the auth middleware.

- [ ] **Step 2: Screen**

`apps/mobile/app/(tabs)/progress/weekly-summary.tsx`:

```tsx
import { ScrollView, StyleSheet, View, Pressable } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { EditorialText, Screen } from "@/src/design";
import { palette, radius, spacing } from "@language-coach/design-tokens";
import { apiClient } from "@/src/lib/api-client";
import { usePurchases } from "@/src/features/paywall/use-purchases";

type Summary = {
  session_count: number;
  total_seconds: number;
  languages_practiced: number;
};

export default function WeeklySummary() {
  const { isPro } = usePurchases();
  const { data } = useQuery<Summary>({
    queryKey: ["weekly-summary"],
    queryFn: async () => apiClient.get("/v1/progress/weekly-summary"),
  });

  return (
    <Screen variant="gradient">
      <ScrollView contentContainerStyle={styles.container}>
        <EditorialText kind="displayMd" italic style={styles.title}>
          Your week
        </EditorialText>
        {data ? (
          <View style={styles.statsRow}>
            <Stat label="Sessions" value={data.session_count} />
            <Stat label="Minutes" value={Math.floor(data.total_seconds / 60)} />
            <Stat label="Languages" value={data.languages_practiced} />
          </View>
        ) : (
          <EditorialText kind="bodyMd" color={palette.inkSoft}>
            Loading…
          </EditorialText>
        )}
        {!isPro && (
          <Pressable
            onPress={() => router.push("/(modals)/paywall")}
            style={styles.upgrade}
          >
            <EditorialText kind="bodyMd" color={palette.peach}>
              Unlock full feedback history with Pro
            </EditorialText>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <EditorialText kind="displayMd" style={styles.statValue}>
        {value}
      </EditorialText>
      <EditorialText kind="bodySm" color={palette.inkSoft}>
        {label}
      </EditorialText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.xl },
  title: { color: palette.ink },
  statsRow: {
    flexDirection: "row",
    gap: spacing.lg,
    justifyContent: "space-around",
  },
  stat: { alignItems: "center" },
  statValue: { color: palette.ink },
  upgrade: {
    backgroundColor: palette.ink,
    borderRadius: radius.lg,
    padding: spacing.base,
    alignItems: "center",
    marginTop: spacing.lg,
  },
});
```

- [ ] **Step 3: Deep-link route**

In `apps/mobile/app/_layout.tsx` (or wherever deep-link resolution lives), ensure `mylanguagecoach://weekly-summary` routes to `/(tabs)/progress/weekly-summary`.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(tabs)/progress/weekly-summary.tsx \
        apps/api/src/routes/weekly-summary.ts apps/api/src/routes/weekly-summary.test.ts \
        apps/api/src/app.ts apps/mobile/app/_layout.tsx
git commit -m "feat(api+mobile): weekly summary screen + endpoint

Plan 8 M5 Task 22.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 23: Play Console submission prep

**Not code — Bruno walks through the Play Console.**

- [ ] **Step 1: Bump versionCode**

In `apps/mobile/app.config.ts`, bump `versionCode` (current is around 43 — go to 44 or current+1).

```bash
git add apps/mobile/app.config.ts
git commit -m "chore(mobile): bump versionCode for Plan 8

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 2: Update privacy policy**

In `apps/web/content/privacy.en.mdx` and `privacy.fr.mdx`, add a section:

```mdx
## Coach memory

To make conversations feel personalized, we save a short profile of what you've discussed with your coach — recent topics, your approximate level, and a one-line summary of your last session. This information is per-language and only used to inform what your coach says.

You can view, edit, or delete this memory at any time under Profile → Coach's Memory, and you can opt out entirely during onboarding (or by deleting all memory entries). Deleting your account removes all coach memory permanently.

## AI-generated content

Conversations and feedback are produced by AI language models (currently OpenAI's GPT-4o family). The AI may occasionally make mistakes; flagged corrections should be checked against an authoritative grammar reference for important uses.
```

- [ ] **Step 3: Build production**

```
cd apps/mobile && eas build --profile production --platform android
```

Wait ~15-25 min. AAB downloaded.

- [ ] **Step 4: Upload to internal track**

Either:

- `eas submit --profile production --platform android --non-interactive` (requires service-account from existing eas.json)
- Manual upload at https://play.google.com/console → My Language Coach → Testing → Internal testing → Create new release

- [ ] **Step 5: Update Play Console Data Safety**

Confirm the following are declared (account-deletion submission already covered these; verify):

- Personal info: email, name
- Audio: yes, used for app functionality
- "AI content" disclaimer (newer Play requirement) — describe LLM use

- [ ] **Step 6: Test the internal track**

Install the build from your internal-tester link on your phone. Sign in, complete onboarding (memory consent), have a conversation, see feedback sheet, try a role-play, hit the paywall, sandbox-subscribe.

- [ ] **Step 7: Done**

When the build passes the internal-track install + smoke test, Plan 8 ships.

---

# Self-review checklist

Before handing off to executing-plans/subagent-driven-development, verify:

**Spec coverage:**

- [x] Memory (per-language, basic-free / deep-Pro) — Tasks 1-4 + 6
- [x] Feedback (async, 3 panels, gpt-4o) — Tasks 7-9 + 10-11
- [x] Role-play (10 scenarios, 3 free / 7 Pro) — Tasks 12-14
- [x] Freemium gating + paywall — Tasks 15-19
- [x] Push (Day 1/2/7) + Weekly summary — Tasks 20-22
- [x] Play submission — Task 23
- [x] No iOS work (correctly deferred)
- [x] No vocab card game (Plan 9)
- [x] No pronunciation scoring (Plan 10)

**Placeholder scan:** No `TODO` / `TBD` / "implement later" in steps. Code blocks are complete enough for an engineer to copy + adapt to local imports.

**Type consistency:**

- `CoachMemory` type used identically across `coach-memory-schema.ts`, `extract-memory.ts`, `prompts.ts`, mobile hook.
- `SessionFeedback` type used identically across `feedback-schema.ts`, `generate-feedback.ts`, `feedback.ts`, mobile hook.
- `RolePlayScenario` type same in `role-play-scenarios.ts`, `prompts.ts`, mobile picker.

**Known not-shown details (engineer resolves at task time):**

- Exact existing onboarding final-step file path (Task 5 Step 1 prompts the engineer to find it)
- Exact `use-conversation` hook internals for surfacing `conversationId` (Task 11 Step 1)
- Existing api-client error-handler shape (Task 18 Step 5)
- Existing onboarding RPC path for `scheduleOnboardingPushes` hook (Task 21 Step 2)

These are all "read the closest existing file, match the pattern" — not blockers.

---

# Execution

Plan complete and saved to `docs/superpowers/plans/2026-05-30-plan-8-coaching-loop.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between, fast iteration. Best when tasks are independent enough to spawn in parallel sometimes.

**2. Inline Execution** — execute tasks in this session sequentially, batch with checkpoints at the end of each milestone.

Given the size of Plan 8 (23 tasks) AND Bruno's constraint of testing on-device at each milestone checkpoint, **subagent-driven** is the natural fit — each task ships in isolation, Bruno tests milestones M1-M5 at their checkpoints, and the main agent reviews diffs between tasks.

Which approach?
