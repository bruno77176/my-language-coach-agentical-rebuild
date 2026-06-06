/* eslint-disable no-console -- CLI script: stdout output is the user-facing UI */
/**
 * One-time backfill: copy vocab already extracted into session_feedback.vocab
 * into the persistent vocab_items deck. Idempotent — dedupes on the
 * (user_id, language, term) unique constraint, so it's safe to re-run.
 *
 *   pnpm tsx src/db/backfill-vocab.ts
 */
import postgres from "postgres";

async function main() {
  // Read DATABASE_URL directly rather than via loadEnv(): this maintenance
  // script only touches the database and shouldn't require the full prod env
  // schema (RevenueCat/Sentry/etc.) just to run a single backfill query.
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set (pass --env-file=.env)");
  }
  const sql = postgres(databaseUrl, { max: 1, prepare: false });
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
