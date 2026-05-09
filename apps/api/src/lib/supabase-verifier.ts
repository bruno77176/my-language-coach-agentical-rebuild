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
    return { userId: data.user.id };
  };
}
