import Constants from "expo-constants";
import { z } from "zod";

const EnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SENTRY_DSN_MOBILE: z.string().url(),
  POSTHOG_API_KEY: z.string().min(1),
  POSTHOG_HOST: z.string().url(),
});

export type Env = z.infer<typeof EnvSchema>;

const raw = Constants.expoConfig?.extra ?? {};
const result = EnvSchema.safeParse(raw);

if (!result.success) {
  console.error("Invalid mobile env config:", result.error.format());
  throw new Error(
    "Mobile env config is missing or invalid — check app.config.ts and .env",
  );
}

export const env: Env = result.data;
