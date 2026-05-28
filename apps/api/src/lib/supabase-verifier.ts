import { createClient } from "@supabase/supabase-js";
import type { Env } from "../env";
import type { Verifier } from "../middleware/auth";

export function createSupabaseVerifier(env: Env): Verifier {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY);

  return async (token) => {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      throw new Error(error?.message ?? "Invalid Supabase JWT");
    }
    // Defense in depth: Supabase's "Confirm email" project toggle is what
    // normally prevents unverified signups from getting a session, but the
    // toggle is a single point of failure. Reject any token whose user has
    // never confirmed ownership of their email.
    if (!data.user.email_confirmed_at) {
      throw new Error("Email not confirmed");
    }
    return { userId: data.user.id };
  };
}
