import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "My Language Coach",
  slug: "my-language-coach",
  scheme: "mylanguagecoach",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/icon.png",
    resizeMode: "contain",
    backgroundColor: "#fde7d1",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.brunomoise.mylanguagecoach",
  },
  android: {
    package: "com.anonymous.mylanguagecoach",
    adaptiveIcon: {
      foregroundImage: "./assets/icon.png",
      backgroundColor: "#fde7d1",
    },
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-notifications",
    "expo-audio",
    [
      "@sentry/react-native/expo",
      {
        organization: "bruno77176",
        project: "language-coach-mobile",
      },
    ],
  ],
  extra: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    SENTRY_DSN_MOBILE: process.env.SENTRY_DSN_MOBILE,
    POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
    POSTHOG_HOST: process.env.POSTHOG_HOST,
    eas: {
      projectId: process.env.EAS_PROJECT_ID,
    },
  },
});
