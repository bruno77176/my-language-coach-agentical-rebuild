import "../global.css";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
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

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const setSession = useAuthStore((s) => s.setSession);
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
