import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Env } from "../env";

export type Database = ReturnType<typeof createDb>;

export function createDb(env: Env) {
  const client = postgres(env.DATABASE_URL, {
    max: 10,
    prepare: false,
  });
  return drizzle(client);
}
