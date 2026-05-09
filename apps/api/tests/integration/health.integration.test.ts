/**
 * Integration test: /health against a real Postgres.
 *
 * Skips locally if DATABASE_URL_TEST is not set. CI sets it to a Postgres
 * service container (see .github/workflows/ci.yml). This is the pattern for
 * any test that needs a real DB; copy this skipIf guard into new
 * `*.integration.test.ts` files as we add them in later plans.
 *
 * Why CI-only: the dev's machine is a domain-joined corporate Windows where
 * WSL2 cannot create Hyper-V VMs (Hyper-V Administrators policy block), so
 * Docker Desktop / Rancher Desktop don't run. Until that's resolved or a
 * personal machine is used, integration tests live in CI only.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { createApp } from "../../src/app";
import type { Database } from "../../src/db";
import { createDb } from "../../src/db";

const TEST_DB_URL = process.env.DATABASE_URL_TEST;

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
};

describe.skipIf(!TEST_DB_URL)(
  "integration: GET /health against real Postgres",
  () => {
    let raw: ReturnType<typeof postgres>;
    let db: Database;

    beforeAll(async () => {
      raw = postgres(TEST_DB_URL!, { max: 1, prepare: false });
      await raw`SELECT 1`; // Sanity: DB is reachable
      db = createDb({ ...baseEnv, DATABASE_URL: TEST_DB_URL! });
    });

    afterAll(async () => {
      await raw.end({ timeout: 5 });
    });

    it("returns 200 ok with dbOk=true when DB is reachable", async () => {
      const app = createApp(baseEnv, db);
      const res = await app.request("/health");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string; dbOk: boolean };
      expect(body.status).toBe("ok");
      expect(body.dbOk).toBe(true);
    });
  },
);
