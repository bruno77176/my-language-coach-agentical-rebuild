import type { ExpoConfig, ConfigContext } from "expo/config";
import withStripBootCompleted from "./plugins/with-strip-boot-completed";

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleIosUrlScheme = process.env.GOOGLE_IOS_URL_SCHEME;

  // EAS's local pre-flight evaluates this file without loading .env; only the
  // remote build VM gets env vars from eas.json. Skip the Google plugin when
  // the env var is missing so pre-flight doesn't crash. The plugin is included
  // on actual builds (local --local or remote) where eas.json env applies.
  // ExpoConfig["plugins"] is typed as a tuple of strings/[string, opts] only,
  // but Expo accepts inline ConfigPlugin functions at runtime too. Cast so
  // withStripBootCompleted can be appended next to the named plugins.
  const plugins = [
    "expo-router",
    "expo-secure-store",
    "expo-notifications",
    "expo-audio",
    "expo-stream-audio",
    "expo-apple-authentication",
    withStripBootCompleted,
  ] as unknown as NonNullable<ExpoConfig["plugins"]>;
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
    version: "2.0.1",
    orientation: "portrait",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    // EAS Update (OTA). runtimeVersion uses the appVersion policy: a build's
    // runtime is its marketing version (2.0.0), so JS-only updates published with
    // `eas update` reach every build sharing that version. When NATIVE code/deps
    // change, bump `version` and ship a new store build — that isolates the new
    // native runtime so an OTA can't land an incompatible JS bundle on an old
    // binary. (appVersion, not fingerprint, because fingerprint hashes can differ
    // across machines/OSes and we run `eas update` from Windows.)
    runtimeVersion: { policy: "appVersion" },
    updates: {
      url: "https://u.expo.dev/730e3dc2-1bf3-4ca3-94c4-1dc1795409f7",
    },
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/splash-transparent.png",
      resizeMode: "contain",
      backgroundColor: "#fde7d1",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.brunomoise.mylanguagecoach",
      buildNumber: "40",
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
      versionCode: 78,
      // SDK 54 Expo Android applies edge-to-edge by default when enabled here;
      // fixes the Play Console "edge-to-edge display" advisory for Android 15+.
      edgeToEdgeEnabled: true,
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
      EXPO_PUBLIC_REVENUECAT_ANDROID_KEY:
        process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
      eas: {
        projectId: "730e3dc2-1bf3-4ca3-94c4-1dc1795409f7",
      },
    },
  };
};
