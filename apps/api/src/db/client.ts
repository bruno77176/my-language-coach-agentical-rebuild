import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Env } from "../env";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;

export function createDb(env: Env) {
  const client = postgres(env.DATABASE_URL, {
    // Pool sized for Fly's request concurrency (BRU-36). NOTE: going much above
    // this needs the Supabase pgbouncer pooler (DATABASE_URL on port 6543) or
    // Postgres exhausts direct connections — and ≥2 Fly machines multiply it.
    max: 20,
    prepare: false,
    // Fail fast if the DB is unreachable rather than hanging a turn.
    connect_timeout: 10, // seconds
    idle_timeout: 20, // seconds — release idle pooled connections
    // Cap any single statement so a slow/hung query can't pin a connection and
    // cascade into turn timeouts under load.
    connection: { statement_timeout: 15000 }, // ms
  });
  // Pass schema so the relational query API (db.query.<table>.findFirst, etc.)
  // works without needing to declare relations() between tables.
  return drizzle(client, { schema });
}
