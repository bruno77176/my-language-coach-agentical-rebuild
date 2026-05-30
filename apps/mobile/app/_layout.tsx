import "../global.css";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
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

const REVENUECAT_KEY =
  (Constants.expoConfig?.extra?.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY as
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

  // RevenueCat SDK init (Android-only for v2). The public SDK key is
  // namespaced EXPO_PUBLIC_ so it ships in the client bundle — that's
  // intentional, RC public keys are not secret. iOS is gated until we
  // wire the App Store offering (Plan 9).
  useEffect(() => {
    if (Platform.OS === "android" && REVENUECAT_KEY) {
      Purchases.configure({ apiKey: REVENUECAT_KEY });
    }
  }, []);

  // Once Supabase resolves the user, alias their RC identity to the
  // Supabase user.id so the webhook (Task 19) can map entitlement events
  // back to the right account.
  useEffect(() => {
    if (Platform.OS !== "android" || !REVENUECAT_KEY) return;
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
