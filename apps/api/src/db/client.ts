import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Env } from "../env";
import * as schema from "./schema";

export type Database = ReturnType<typeof createDb>;

export function createDb(env: Env) {
  const client = postgres(env.DATABASE_URL, {
    max: 10,
    prepare: false,
  });
  // Pass schema so the relational query API (db.query.<table>.findFirst, etc.)
  // works without needing to declare relations() between tables.
  return drizzle(client, { schema });
}
