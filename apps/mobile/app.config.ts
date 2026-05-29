import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleIosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;

  // EAS's local pre-flight evaluates this file without loading .env; only the
  // remote build VM gets env vars from eas.json. Skip the Google plugin when
  // the env var is missing so pre-flight doesn't crash. The plugin is included
  // on actual builds (local --local or remote) where eas.json env applies.
  const plugins: ExpoConfig["plugins"] = [
    "expo-router",
    "expo-secure-store",
    "expo-notifications",
    "expo-audio",
    "expo-apple-authentication",
  ];
  if (googleIosUrlScheme) {
    plugins.push([
      "@react-native-google-signin/google-signin",
      { iosUrlScheme: googleIosUrlScheme },
    ]);
  } else {
    console.warn(
      "[app.config] GOOGLE_IOS_URL_SCHEME is not set — Google sign-in plugin skipped (expected during EAS pre-flight; real builds set it via eas.json)",
    );
  }

  return {
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
      image: "./assets/splash-transparent.png",
      resizeMode: "contain",
      backgroundColor: "#fde7d1",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.brunomoise.mylanguagecoach",
      buildNumber: "11",
      usesAppleSignIn: true,
      associatedDomains: ["applinks:www.mylanguagecoach.app"],
      infoPlist: {
        NSMicrophoneUsageDescription:
          "We use the microphone so you can talk to your coach.",
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "com.anonymous.mylanguagecoach",
      versionCode: 45,
      permissions: ["RECORD_AUDIO"],
      intentFilters: [
        {
          action: "VIEW",
          autoVerify: true,
          data: [
            {
              scheme: "https",
              host: "www.mylanguagecoach.app",
              pathPrefix: "/auth/",
            },
          ],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#fde7d1",
      },
    },
    plugins,
    extra: {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
      SENTRY_DSN_MOBILE: process.env.SENTRY_DSN_MOBILE,
      POSTHOG_API_KEY: process.env.POSTHOG_API_KEY,
      POSTHOG_HOST: process.env.POSTHOG_HOST,
      GOOGLE_WEB_CLIENT_ID: process.env.GOOGLE_WEB_CLIENT_ID,
      GOOGLE_IOS_CLIENT_ID: process.env.GOOGLE_IOS_CLIENT_ID,
      eas: {
        projectId: "730e3dc2-1bf3-4ca3-94c4-1dc1795409f7",
      },
    },
  };
};
