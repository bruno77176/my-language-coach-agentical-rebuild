import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import {
  API_BASE_URL,
  authHeader,
  clientPlatformHeader,
} from "@/src/lib/api-client";
import { supabase } from "@/src/lib/supabase";

// Register this device's Expo push token once the user is signed in: request
// notification permission (once), fetch the Expo push token, and POST it to the
// API so the server can deliver reminders in the user's native language.
// Best-effort — any failure is swallowed so it never blocks the app. Without
// this, push_tokens stays empty and no notification is ever delivered.
export function useRegisterPushToken(userId: string | undefined) {
  const registeredFor = useRef<string | null>(null);
  useEffect(() => {
    if (!userId || registeredFor.current === userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const current = await Notifications.getPermissionsAsync();
        let granted = current.granted;
        if (!granted && current.canAskAgain) {
          const req = await Notifications.requestPermissionsAsync();
          granted = req.granted;
        }
        if (!granted || cancelled) return;
        const projectId = (
          Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined
        )?.projectId;
        const { data: token } = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        if (!token || cancelled) return;
        // Retry with backoff: this hook fires the moment the session loads, which
        // can race the Supabase access-token refresh and send a stale JWT (401).
        // Re-fetch the auth header each attempt so a refreshed token lands, and
        // only mark success on an OK response (never give up after a transient
        // 401 — that would leave the device unregistered until the next restart).
        // Force a token refresh up front: this hook fires the instant the session
        // loads, racing Supabase's own refresh, so getSession() can otherwise hand
        // authHeader() a stale JWT and the register call 401s.
        await supabase.auth.refreshSession().catch(() => {});
        for (let attempt = 0; attempt < 5 && !cancelled; attempt++) {
          try {
            const res = await fetch(`${API_BASE_URL}/v1/push/register`, {
              method: "POST",
              headers: {
                authorization: await authHeader(),
                "content-type": "application/json",
                ...clientPlatformHeader(),
              },
              body: JSON.stringify({
                expo_push_token: token,
                platform: Platform.OS,
              }),
            });
            if (res.ok) {
              registeredFor.current = userId;
              return;
            }
          } catch {
            // network hiccup — fall through to the backoff and retry
          }
          // Stale token or hiccup — force a fresh token, then back off and retry.
          await supabase.auth.refreshSession().catch(() => {});
          await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
        }
      } catch {
        // best-effort — registration failure must not break the app
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);
}
