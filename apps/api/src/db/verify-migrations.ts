/* eslint-disable no-console -- CLI script: stdout output is the user-facing UI */
/**
 * Post-migration verification.
 *
 * Confirms tables, functions, RLS state, and seed data after running
 * `run-migrations.ts`. Read-only — safe to run any time.
 *
 *   pnpm tsx src/db/verify-migrations.ts
 */
import postgres from "postgres";
import { loadEnv } from "../env";

const EXPECTED_TABLES = [
  "conversations",
  "entitlements",
  "messages",
  "profiles",
  "push_tokens",
  "streak_days",
  "topics",
  "vocab_items",
  "waitlist",
];
const EXPECTED_FUNCTIONS = [
  "complete_onboarding",
  "current_streak",
  "get_progress_summary",
  "longest_streak",
  "clear_my_translations",
];

async function main() {
  const env = loadEnv();
  const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });

  try {
    const tables = await sql<{ tablename: string; rowsecurity: boolean }[]>`
        SELECT tablename, rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY tablename
      `;
    console.log("== TABLES ==");
    for (const t of tables) {
      console.log(`  ${t.tablename.padEnd(20)} rls=${t.rowsecurity}`);
    }
    console.log(`Total: ${tables.length}`);

    const tableNames = new Set(tables.map((t) => t.tablename));
    const missing = EXPECTED_TABLES.filter((t) => !tableNames.has(t));
    if (missing.length) {
      console.error("MISSING TABLES:", missing);
      process.exitCode = 1;
    }
    const userOwned = tables.filter((t) =>
      EXPECTED_TABLES.includes(t.tablename),
    );
    const rlsMissing = userOwned.filter((t) => !t.rowsecurity);
    if (rlsMissing.length) {
      console.error(
        "RLS NOT ENABLED:",
        rlsMissing.map((t) => t.tablename),
      );
      process.exitCode = 1;
    }

    const functions = await sql<{ proname: string }[]>`
        SELECT proname
        FROM pg_proc
        WHERE proname = ANY(${EXPECTED_FUNCTIONS})
        ORDER BY proname
      `;
    console.log("\n== FUNCTIONS ==");
    for (const f of functions) console.log(`  ${f.proname}`);
    console.log(`Total: ${functions.length}`);
    if (functions.length !== EXPECTED_FUNCTIONS.length) {
      console.error("MISSING FUNCTIONS");
      process.exitCode = 1;
    }

    const topicCount = await sql<
      { count: number }[]
    >`SELECT count(*)::int AS count FROM topics WHERE is_built_in`;
    const builtInTopicCount = topicCount[0]?.count ?? 0;
    console.log("\n== TOPICS ==");
    console.log(`  built-in topics: ${builtInTopicCount}`);
    if (builtInTopicCount !== 3) {
      console.error("EXPECTED 3 BUILT-IN TOPICS");
      process.exitCode = 1;
    }

    const policies = await sql<{ tablename: string; policyname: string }[]>`
        SELECT tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname
      `;
    console.log("\n== RLS POLICIES ==");
    for (const p of policies)
      console.log(`  ${p.tablename.padEnd(20)} ${p.policyname}`);
    console.log(`Total: ${policies.length}`);

    const constraints = await sql<{ conname: string }[]>`
        SELECT conname
        FROM pg_constraint
        WHERE conname IN ('push_tokens_platform_check', 'entitlements_plan_check')
        ORDER BY conname
      `;
    console.log("\n== CHECK CONSTRAINTS ==");
    for (const c of constraints) console.log(`  ${c.conname}`);
    if (constraints.length !== 2) {
      console.error("MISSING CHECK CONSTRAINTS");
      process.exitCode = 1;
    }

    const migrations = await sql<{ filename: string }[]>`
        SELECT filename FROM __app_migrations ORDER BY filename
      `;
    console.log("\n== APPLIED MIGRATIONS ==");
    for (const m of migrations) console.log(`  ${m.filename}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("Verification crashed:", err);
  process.exit(1);
});
