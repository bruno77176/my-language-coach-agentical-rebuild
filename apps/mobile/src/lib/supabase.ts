import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";
import { secureStorage } from "./secure-storage";

export const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      // Store JWTs in the OS keychain/keystore, not plaintext AsyncStorage
      // (BRU-37). Existing sessions migrate over on first read.
      storage: secureStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
