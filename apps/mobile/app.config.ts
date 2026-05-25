import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  if (!process.env.GOOGLE_IOS_URL_SCHEME) {
    console.warn(
      "[app.config] GOOGLE_IOS_URL_SCHEME is not set — iOS Google sign-in will not return to the app",
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
      buildNumber: "6",
      usesAppleSignIn: true,
      infoPlist: {
        NSMicrophoneUsageDescription:
          "We use the microphone so you can talk to your coach.",
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "com.anonymous.mylanguagecoach",
      versionCode: 40,
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
      "expo-apple-authentication",
      [
        "@react-native-google-signin/google-signin",
        {
          // build-time only — not forwarded to JS via extra
          iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME,
        },
      ],
    ],
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
