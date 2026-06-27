/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration test: digest pipeline against a real Postgres (with pgvector).
 *
 * Skips locally if DATABASE_URL_TEST is not set. CI sets it to a pgvector-enabled
 * Postgres service container (see .github/workflows/ci.yml). This mirrors the
 * skip guard and setup pattern from health.integration.test.ts.
 *
 * Why CI-only: the dev's machine is a domain-joined corporate Windows where
 * WSL2 cannot create Hyper-V VMs, so Docker is blocked. Until resolved,
 * integration tests run in CI only.
 *
 * Before running migrations we create minimal Supabase stubs (auth schema +
 * auth.uid() function + authenticated role) so RLS policy migrations that call
 * auth.uid() can be applied to plain Postgres without error. The API connects
 * via the superuser DATABASE_URL, which bypasses RLS, so the stubs' NULL return
 * value has no effect on test correctness.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { createDb } from "../../src/db";
import type { Database } from "../../src/db";
import {
  profiles,
  entitlements,
  conversations,
  messages,
  digestJobs,
  memoryItems,
} from "../../src/db/schema";
import { applyMigrations } from "../../src/db/run-migrations";
import { processOneJob } from "../../src/jobs/digest-runner";

const TEST_DB_URL = process.env.DATABASE_URL_TEST;

// Fixed UUIDs for this test: deterministic cleanup across repeated CI runs.
const TEST_USER_ID = "00000000-0000-0000-0000-000000000042";
const TEST_CONV_ID = "00000000-0000-0000-0000-000000000043";

// Helper: build a distinct 1536-element unit vector seeded at position `seed`.
function makeEmbedding(seed: number): number[] {
  return Array.from({ length: 1536 }, (_, i) => (i === seed ? 1 : 0));
}

// Fake OpenAI client: chat returns 2 memory items; embeddings returns 2 distinct
// 1536-dim vectors. Satisfies extractMemoryItems + embedTexts without network.
const fakeOpenai = {
  chat: {
    completions: {
      create: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  items: [
                    {
                      type: "mistake",
                      content: "Used wrong article 'der' instead of 'die'",
                    },
                    {
                      type: "fact",
                      content: "User is learning German for travel purposes",
                    },
                  ],
                }),
              },
            },
          ],
        }),
    },
  },
  embeddings: {
    create: ({ input }: { input: string[] }) =>
      Promise.resolve({
        data: input.map((_, i) => ({ index: i, embedding: makeEmbedding(i) })),
        usage: { prompt_tokens: input.length, total_tokens: input.length },
      }),
  },
};

// Mirror baseEnv from health.integration.test.ts exactly.
const baseEnv = {
  NODE_ENV: "test" as const,
  PORT: 3000,
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "publishable",
  SUPABASE_SECRET_KEY: "secret",
  DATABASE_URL:
    TEST_DB_URL ??
    "postgres://placeholder:placeholder@localhost:5432/placeholder",
  SENTRY_DSN: "https://stub@sentry.io/1",
  OPENAI_API_KEY: "openai-stub",
  DEEPGRAM_API_KEY: "deepgram-stub",
  ELEVENLABS_API_KEY: "elevenlabs-stub",
  ACCOUNT_DELETION_SECRET:
    "0000000000000000000000000000000000000000000000000000000000000000",
  RESEND_API_KEY: "re_test_stub",
  PUBLIC_WEB_BASE_URL: "http://localhost:3002",
  REVENUECAT_WEBHOOK_SECRET: "test-revenuecat-webhook-secret-1234567890",
};

describe.skipIf(!TEST_DB_URL)(
  "integration: digest pipeline against real Postgres",
  () => {
    let raw: ReturnType<typeof postgres>;
    let db: Database;

    beforeAll(async () => {
      raw = postgres(TEST_DB_URL!, { max: 1, prepare: false });

      // Create Supabase stubs so RLS policy migrations work in plain Postgres CI.
      // auth.uid() returns NULL (superuser role bypasses RLS anyway, so this is
      // safe — the policies exist but never gate the test queries).
      await raw.unsafe(`
        CREATE SCHEMA IF NOT EXISTS auth;
        CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
          LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT FROM pg_roles WHERE rolname = 'authenticated'
          ) THEN
            CREATE ROLE authenticated;
          END IF;
        END $$;
      `);

      await applyMigrations(raw);

      db = createDb({ ...baseEnv, DATABASE_URL: TEST_DB_URL! });

      // Clean up any prior rows for the test user in FK-safe order.
      await db.delete(memoryItems).where(eq(memoryItems.userId, TEST_USER_ID));
      await db.delete(digestJobs).where(eq(digestJobs.userId, TEST_USER_ID));
      await db
        .delete(messages)
        .where(eq(messages.conversationId, TEST_CONV_ID));
      await db
        .delete(entitlements)
        .where(eq(entitlements.userId, TEST_USER_ID));
      await db
        .delete(conversations)
        .where(eq(conversations.userId, TEST_USER_ID));
      await db.delete(profiles).where(eq(profiles.userId, TEST_USER_ID));

      // Seed: profile with memory_enabled=true (required columns per schema.ts).
      await db.insert(profiles).values({
        userId: TEST_USER_ID,
        displayName: "Integration Test User",
        nativeLang: "en",
        targetLang: "de",
        timezone: "UTC",
        memoryEnabled: true,
      });

      // Seed: pro entitlement with proUntil 30 days in the future.
      // monthlyVoiceSecondsResetAt is notNull with no DB default.
      await db.insert(entitlements).values({
        userId: TEST_USER_ID,
        plan: "pro",
        proUntil: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        monthlyVoiceSecondsResetAt: new Date(),
      });

      // Seed: a conversation in German.
      await db.insert(conversations).values({
        id: TEST_CONV_ID,
        userId: TEST_USER_ID,
        language: "de",
      });

      // Seed: 2 messages (user + coach) — loadTranscript reads these.
      await db.insert(messages).values([
        {
          conversationId: TEST_CONV_ID,
          role: "user",
          text: "Ich habe ein Fehler gemacht.",
        },
        {
          conversationId: TEST_CONV_ID,
          role: "coach",
          text: "Es heißt 'einen Fehler'. Warum lernst du Deutsch?",
        },
      ]);

      // Seed: a pending digest job for this conversation.
      await db.insert(digestJobs).values({
        userId: TEST_USER_ID,
        conversationId: TEST_CONV_ID,
        languageCode: "de",
        status: "pending",
      });
    });

    afterAll(async () => {
      // Clean up all test data in FK-safe order.
      await db.delete(memoryItems).where(eq(memoryItems.userId, TEST_USER_ID));
      await db.delete(digestJobs).where(eq(digestJobs.userId, TEST_USER_ID));
      await db
        .delete(messages)
        .where(eq(messages.conversationId, TEST_CONV_ID));
      await db
        .delete(entitlements)
        .where(eq(entitlements.userId, TEST_USER_ID));
      await db
        .delete(conversations)
        .where(eq(conversations.userId, TEST_USER_ID));
      await db.delete(profiles).where(eq(profiles.userId, TEST_USER_ID));
      await raw.end({ timeout: 5 });
    });

    it("processes a pending digest job and inserts 2 memory_items", async () => {
      // processOneJob uses fakeOpenai for extractMemoryItems + embedTexts;
      // everything else (DB reads/writes) runs against the real Postgres.
      const result = await processOneJob(db, fakeOpenai as any);

      expect(result).toBe("processed");

      // Verify 2 memory items were inserted for the test user.
      const items = await db.query.memoryItems.findMany({
        where: (t, { eq: e }) => e(t.userId, TEST_USER_ID),
      });
      expect(items).toHaveLength(2);
      expect(items.map((r) => r.type).sort()).toEqual(["fact", "mistake"]);

      // Verify the digest job is now 'done'.
      const job = await db.query.digestJobs.findFirst({
        where: (t, { eq: e }) => e(t.conversationId, TEST_CONV_ID),
      });
      expect(job?.status).toBe("done");
    });
  },
);
