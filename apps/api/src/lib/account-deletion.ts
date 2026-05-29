import { eq } from "drizzle-orm";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../db";
import { profiles } from "../db/schema/profiles";
import { topics } from "../db/schema/topics";
import { deleteAllUserAudio } from "./storage";

export type DeleteUserAccountInput = {
  db: Database;
  supabaseAdmin: SupabaseClient;
  userId: string;
};

// Order: topics (no FK on user_id), then storage (deleted before profiles
// so a partial failure doesn't orphan paths after the cascade clears
// conversation IDs from the DB), then profiles (cascades to conversations,
// messages, streak_days, vocab_items, entitlements, push_tokens; sets
// user_id NULL on usage_events and revenue_events), then the auth user.
export async function deleteUserAccount(
  input: DeleteUserAccountInput,
): Promise<void> {
  const { db, supabaseAdmin, userId } = input;

  await db.delete(topics).where(eq(topics.userId, userId));
  await deleteAllUserAudio(supabaseAdmin, userId);
  await db.delete(profiles).where(eq(profiles.userId, userId));

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    throw new Error(`Failed to delete auth user: ${error.message}`);
  }
}
