import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "My Language Coach",
  slug: "my-language-coach",
  scheme: "mylanguagecoach",
  version: "2.0.0",
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
    supportsTablet: true,
    bundleIdentifier: "com.brunomoise.mylanguagecoach",
    buildNumber: "5",
    infoPlist: {
      NSMicrophoneUsageDescription:
        "We use the microphone so you can talk to your coach.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.anonymous.mylanguagecoach",
    versionCode: 39,
    permissions: ["RECORD_AUDIO"],
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
  ],
  extra: {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    SENTRY_DSN_MOBILE: process.env.SENTRY_DSN_MOBILE,
    POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
    POSTHOG_HOST: process.env.POSTHOG_HOST,
    eas: {
      projectId: "730e3dc2-1bf3-4ca3-94c4-1dc1795409f7",
    },
  },
});
