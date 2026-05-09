import { useEffect } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { supabase } from "@/src/lib/supabase";

export default function VerifyScreen() {
  useEffect(() => {
    const consume = async (url: string) => {
      // Magic link URLs from Supabase typically look like:
      //   mylanguagecoach://verify#access_token=...&refresh_token=...&type=magiclink
      // Try exchangeCodeForSession first (handles PKCE flows);
      // fall back to manual hash-fragment parsing for implicit-flow magic links.
      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(url);
        if (!error && data.session) {
          router.replace("/");
          return;
        }
      } catch {
        // fall through to manual parse
      }

      const parsed = Linking.parse(url);
      const params = (parsed.queryParams ?? {}) as Record<
        string,
        string | undefined
      >;
      const access_token = params.access_token;
      const refresh_token = params.refresh_token;
      if (access_token && refresh_token) {
        const { error: setErr } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (!setErr) {
          router.replace("/");
          return;
        }
      }
      router.replace("/(auth)/sign-in");
    };

    Linking.getInitialURL().then((url) => {
      if (url) void consume(url);
    });
    const sub = Linking.addEventListener("url", ({ url }) => void consume(url));
    return () => sub.remove();
  }, []);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" />
      <Text className="mt-4 text-gray-600">Signing you in…</Text>
    </View>
  );
}
