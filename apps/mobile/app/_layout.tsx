import "../global.css";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import Purchases from "react-native-purchases";
import {
  Fraunces_500Medium,
  Fraunces_500Medium_Italic,
  Fraunces_700Bold,
} from "@expo-google-fonts/fraunces";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { supabase } from "@/src/lib/supabase";
import { queryClient } from "@/src/lib/query-client";
import { useAuthStore } from "@/src/features/auth/auth-store";
import { ErrorBoundary } from "@/src/design";
import { IntroScreen } from "@/src/features/intro/IntroScreen";
import { useColdStart } from "@/src/features/intro/use-cold-start";

// RevenueCat public SDK keys are platform-specific (goog_… for the Play
// Store, appl_… for the App Store). Both ship in the client bundle via
// EXPO_PUBLIC_ — RC public keys are not secret. Pick the key for the
// current store; web/other platforms get "" and the SDK stays unconfigured.
const RC_SUPPORTED = Platform.OS === "ios" || Platform.OS === "android";
const REVENUECAT_KEY =
  ((Platform.OS === "ios"
    ? Constants.expoConfig?.extra?.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : Constants.expoConfig?.extra?.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY) as
    | string
    | undefined) ?? "";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const setSession = useAuthStore((s) => s.setSession);
  const status = useAuthStore((s) => s.status);
  const session = useAuthStore((s) => s.session);
  const router = useRouter();
  const segments = useSegments();
  const coldStart = useColdStart();
  const [introDone, setIntroDone] = useState(!coldStart);

  const [fontsReady] = useFonts({
    Fraunces_500Medium,
    Fraunces_500Medium_Italic,
    Fraunces_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => data.subscription.unsubscribe();
  }, [setSession]);

  // Route to the right screen when the user taps a push notification.
  // Payload URLs look like `mylanguagecoach:///(tabs)/practice` —
  // strip the scheme and hand the path to expo-router.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        const url = (data as { url?: string })?.url;
        if (!url) return;
        const match = url.match(/^mylanguagecoach:\/\/\/?(.+)$/);
        if (!match || !match[1]) return;
        const path = match[1].startsWith("/") ? match[1] : "/" + match[1];
        router.push(path as never);
      },
    );
    return () => sub.remove();
  }, [router]);

  // RevenueCat SDK init on both stores. The per-store key is resolved
  // above; if it's missing (e.g. unsupported platform or env unset) the
  // SDK stays unconfigured and the app degrades to free-only.
  useEffect(() => {
    if (RC_SUPPORTED && REVENUECAT_KEY) {
      Purchases.configure({ apiKey: REVENUECAT_KEY });
    }
  }, []);

  // Once Supabase resolves the user, alias their RC identity to the
  // Supabase user.id so the webhook (Task 19) can map entitlement events
  // back to the right account.
  useEffect(() => {
    if (!RC_SUPPORTED || !REVENUECAT_KEY) return;
    if (session?.user?.id) {
      void Purchases.logIn(session.user.id).catch(() => {});
    }
  }, [session?.user?.id]);

  // Global auth gate: when the user signs out from anywhere (e.g. Profile),
  // route them back to the sign-in screen. The route group check prevents
  // a loop while they're already in (auth) signing in.
  useEffect(() => {
    if (status !== "anonymous") return;
    const topGroup = segments[0];
    if (topGroup === "(auth)") return;
    router.replace("/(auth)/sign-in");
  }, [status, segments, router]);

  if (!fontsReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            {!introDone ? (
              <IntroScreen onFinish={() => setIntroDone(true)} />
            ) : (
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(onboarding)" />
                <Stack.Screen name="(tabs)" />
              </Stack>
            )}
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
