import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { supabase } from "@/src/lib/supabase";
import { EditorialText } from "@/src/design";
import { palette, spacing } from "@language-coach/design-tokens";

export default function VerifyScreen() {
  const [debugMsg, setDebugMsg] = useState("Waiting for magic link…");

  useEffect(() => {
    const consume = async (url: string) => {
      setDebugMsg(`Got URL: ${url.slice(0, 80)}…`);
      // eslint-disable-next-line no-console
      console.log("[VERIFY] received url:", url);

      // Try PKCE-style first (?code=...).
      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(url);
        if (!error && data.session) {
          // eslint-disable-next-line no-console
          console.log("[VERIFY] PKCE exchange OK");
          router.replace("/");
          return;
        }
        if (error) {
          // eslint-disable-next-line no-console
          console.log("[VERIFY] PKCE exchange error:", error.message);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log("[VERIFY] PKCE threw:", e);
      }

      // Fallback: parse fragment (#access_token=...&refresh_token=...) — Linking.parse
      // doesn't extract fragment params, so do it manually.
      const fragmentIndex = url.indexOf("#");
      const queryIndex = url.indexOf("?");
      const tokenSource =
        fragmentIndex >= 0
          ? url.slice(fragmentIndex + 1)
          : queryIndex >= 0
            ? url.slice(queryIndex + 1)
            : "";
      const params = new URLSearchParams(tokenSource);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");

      // eslint-disable-next-line no-console
      console.log(
        "[VERIFY] parsed tokens — has access:",
        !!access_token,
        "has refresh:",
        !!refresh_token,
      );

      if (access_token && refresh_token) {
        const { error: setErr } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });
        if (!setErr) {
          // eslint-disable-next-line no-console
          console.log("[VERIFY] setSession OK");
          router.replace("/");
          return;
        }
        Alert.alert("Sign-in failed", `setSession error: ${setErr.message}`);
        // eslint-disable-next-line no-console
        console.log("[VERIFY] setSession error:", setErr.message);
      }

      // Nothing worked — surface the URL on screen so we can debug.
      Alert.alert(
        "Couldn't sign in",
        `URL had no usable tokens.\n\n${url}\n\nFragment: ${
          fragmentIndex >= 0
            ? url.slice(fragmentIndex + 1, fragmentIndex + 100)
            : "(none)"
        }`,
      );
      router.replace("/(auth)/sign-in");
    };

    Linking.getInitialURL().then((url) => {
      // eslint-disable-next-line no-console
      console.log("[VERIFY] getInitialURL:", url);
      if (url) void consume(url);
      else setDebugMsg("No initial URL — waiting for incoming link…");
    });
    const sub = Linking.addEventListener("url", ({ url }) => {
      // eslint-disable-next-line no-console
      console.log("[VERIFY] addEventListener fired:", url);
      void consume(url);
    });
    return () => sub.remove();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        padding: spacing.xl,
        gap: spacing.base,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ActivityIndicator size="large" color={palette.accent} />
      <EditorialText kind="displayLg" align="center">
        Signing you in…
      </EditorialText>
      <EditorialText kind="bodySm" color={palette.inkSoft} align="center">
        {debugMsg}
      </EditorialText>
    </View>
  );
}
