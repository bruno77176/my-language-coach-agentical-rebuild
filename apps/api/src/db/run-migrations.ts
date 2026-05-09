/* eslint-disable no-console -- CLI script: stdout output is the user-facing UI */
/**
 * Custom migration runner.
 *
 * Why this exists: drizzle-kit's `migrate` command swallows errors and only
 * applies migrations registered in `meta/_journal.json`. We hand-write SQL
 * for RLS policies, plpgsql functions, and seed data (0001/0002/0003) that
 * drizzle-kit can't generate from the schema. This script:
 *   1. Reads every `.sql` file in the migrations folder in alphanumeric order.
 *   2. Tracks applied migrations in a `__app_migrations` table (separate from
 *      drizzle's own `__drizzle_migrations` so they don't conflict).
 *   3. Runs each unapplied migration as a single SQL command via
 *      postgres-js's `simple()` mode so plpgsql `$$` blocks parse correctly.
 *
 * Run with:
 *   pnpm tsx src/db/run-migrations.ts
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { loadEnv } from "../env";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "migrations");

async function main() {
  const env = loadEnv();
  const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });

  try {
    // 1. Bootstrap tracking table
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS __app_migrations (
        filename text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // 2. Discover migration files
    const all = await readdir(MIGRATIONS_DIR);
    const files = all.filter((f) => f.endsWith(".sql")).sort();

    if (files.length === 0) {
      console.log("No migration files found.");
      return;
    }

    // 3. Discover already-applied migrations
    const applied = new Set<string>(
      (
        await sql<{ filename: string }[]>`SELECT filename FROM __app_migrations`
      ).map((r) => r.filename),
    );

    // 4. Apply each unapplied file
    let appliedCount = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`SKIP   ${file} (already applied)`);
        continue;
      }
      const path = join(MIGRATIONS_DIR, file);
      const body = await readFile(path, "utf8");
      console.log(`APPLY  ${file} (${body.length} bytes)`);

      try {
        // postgres-js's simple() mode sends the entire string as a single
        // simple-query message, which preserves plpgsql $$ blocks correctly.
        await sql.unsafe(body).simple();
        await sql`INSERT INTO __app_migrations (filename) VALUES (${file})`;
        appliedCount++;
        console.log(`OK     ${file}`);
      } catch (err) {
        console.error(`FAIL   ${file}`);
        console.error(err);
        process.exitCode = 1;
        return;
      }
    }

    console.log(`\nDone. Applied ${appliedCount} new migration(s).`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("Migration runner crashed:", err);
  process.exit(1);
});
