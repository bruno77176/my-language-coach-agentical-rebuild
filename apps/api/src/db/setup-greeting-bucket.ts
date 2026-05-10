/* eslint-disable no-console */
/**
 * One-shot: create the greeting-audio bucket + RLS policies for the service
 * role. The earlier INSERT-via-tsx attempt silently failed; this version
 * uses explicit error handling and verifies after.
 *
 * Run: pnpm tsx --env-file=.env src/db/setup-greeting-bucket.ts
 */
import postgres from "postgres";
import { loadEnv } from "../env";

async function main() {
  const env = loadEnv();
  const sql = postgres(env.DATABASE_URL, { max: 1, prepare: false });

  try {
    console.log("Creating greeting-audio bucket...");
    const insert = await sql`
      INSERT INTO storage.buckets (id, name, public, file_size_limit)
      VALUES ('greeting-audio', 'greeting-audio', true, 524288)
      ON CONFLICT (id) DO UPDATE
        SET public = true,
            file_size_limit = 524288
      RETURNING id, public
    `;
    console.log("  Bucket result:", insert);

    console.log("Setting up RLS policies on storage.objects...");

    // Drop any prior versions to be idempotent
    await sql`DROP POLICY IF EXISTS "greeting_audio_public_read" ON storage.objects`;
    await sql`DROP POLICY IF EXISTS "greeting_audio_service_insert" ON storage.objects`;
    await sql`DROP POLICY IF EXISTS "greeting_audio_service_update" ON storage.objects`;

    await sql`
      CREATE POLICY "greeting_audio_public_read"
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'greeting-audio')
    `;
    await sql`
      CREATE POLICY "greeting_audio_service_insert"
      ON storage.objects FOR INSERT
      TO service_role
      WITH CHECK (bucket_id = 'greeting-audio')
    `;
    await sql`
      CREATE POLICY "greeting_audio_service_update"
      ON storage.objects FOR UPDATE
      TO service_role
      USING (bucket_id = 'greeting-audio')
      WITH CHECK (bucket_id = 'greeting-audio')
    `;
    console.log("  Policies created.");

    console.log("\nVerifying...");
    const bucket = await sql`
      SELECT id, public, file_size_limit
      FROM storage.buckets WHERE id = 'greeting-audio'
    `;
    console.log("  Bucket:", bucket);
    const policies = await sql`
      SELECT polname FROM pg_policy
      WHERE polrelid = 'storage.objects'::regclass
        AND polname LIKE 'greeting_audio%'
    `;
    console.log("  Policies:", policies);

    console.log("\nDone.");
  } finally {
    await sql.end();
  }
}

void main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
