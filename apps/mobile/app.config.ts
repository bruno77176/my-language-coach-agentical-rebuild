import type { ExpoConfig, ConfigContext } from "expo/config";
import withStripBootCompleted from "./plugins/with-strip-boot-completed";
import withModularHeaders from "./plugins/with-modular-headers";

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
    // AdMob (rewarded "watch an ad for +3 min"). Default to Google's official
    // TEST app IDs so a build without real IDs still runs (and serves test ads)
    // instead of crashing on launch — set ADMOB_ANDROID_APP_ID / ADMOB_IOS_APP_ID
    // via eas.json for prod.
    [
      "react-native-google-mobile-ads",
      {
        androidAppId:
          process.env.ADMOB_ANDROID_APP_ID ??
          "ca-app-pub-3940256099942544~3347511713",
        iosAppId:
          process.env.ADMOB_IOS_APP_ID ??
          "ca-app-pub-3940256099942544~1458002511",
      },
    ],
    withStripBootCompleted,
    withModularHeaders,
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
    version: "2.0.3",
    orientation: "portrait",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    // EAS Update (OTA). runtimeVersion = appVersion policy (a build's runtime is
    // its marketing `version`).
    //
    // POLICY (Bruno, 2026-06-11): keep the marketing `version` frozen and bump
    // only the BUILD NUMBER (ios.buildNumber / android.versionCode) per build —
    // a NEW version needs a fresh Apple Beta App Review before EXTERNAL TestFlight
    // testers can install it (~1-day delay); builds WITHIN a version skip re-review.
    // UPDATE (2026-06-18): Apple APPROVED 2.0.2, which CLOSES the 2.0.2 pre-release
    // train — no further builds can be uploaded under 2.0.2 ("train is closed for
    // new build submissions"). So we bumped to 2.0.3 to ship more internal test
    // builds. Internal testing needs NO Beta App Review, so this bump is free for
    // our own testing; the ~1-day review only bites if/when we open 2.0.3 to
    // EXTERNAL testers. The approved 2.0.2 release (build 43) is untouched.
    //
    // Caveat: because runtime follows the frozen `version`, only OTA-publish
    // (`eas update`) JS-ONLY changes — ship native/dependency changes as new store
    // builds (which we do), never as an OTA, or a 2.0.2 OTA could crash an older
    // 2.0.2 binary that lacks the new native code.
    // (appVersion, not fingerprint, because fingerprint hashes differ across
    // machines/OSes and we run `eas update` from Windows.)
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
      buildNumber: "56",
      usesAppleSignIn: true,
      associatedDomains: ["applinks:www.mylanguagecoach.app"],
      infoPlist: {
        NSMicrophoneUsageDescription:
          "We use the microphone so you can talk to your coach.",
        // react-native-share references the photo library API, so Apple requires
        // these purpose strings even though we only share app-generated images.
        NSPhotoLibraryUsageDescription:
          "Allow access so you can save and share images of your quotes, conversations and feedback.",
        NSPhotoLibraryAddUsageDescription:
          "Allow access so you can save shared images to your photo library.",
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "com.anonymous.mylanguagecoach",
      versionCode: 93,
      // Firebase Cloud Messaging config — required for Android push tokens
      // (getExpoPushTokenAsync). Without it the native FCM SDK is unconfigured
      // and token retrieval fails silently. Pairs with the FCM V1 service-account
      // key uploaded to EAS. Not a secret (ships inside the APK).
      googleServicesFile: "./google-services.json",
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
      EXPO_PUBLIC_REVENUECAT_IOS_KEY:
        process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
      // Rewarded ad unit IDs (per platform). Unset → the util falls back to
      // Google's test ad unit, so dev/test builds still show (test) ads.
      ADMOB_REWARDED_ANDROID: process.env.ADMOB_REWARDED_ANDROID,
      ADMOB_REWARDED_IOS: process.env.ADMOB_REWARDED_IOS,
      eas: {
        projectId: "730e3dc2-1bf3-4ca3-94c4-1dc1795409f7",
      },
    },
  };
};
