// apps/mobile/src/features/practice/use-stale-session-guard.ts
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { endSession } from "@/src/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import {
  ACTIVE_SESSION_KEY,
  type PersistedActiveSession,
} from "./use-conversation";

const STALE_AFTER_MS = 5 * 60 * 1000;

async function readPersisted(): Promise<PersistedActiveSession | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedActiveSession;
    if (
      !parsed ||
      typeof parsed.conversationId !== "string" ||
      typeof parsed.lastActivityAt !== "number" ||
      typeof parsed.eligible !== "boolean"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function useStaleSessionGuard() {
  const queryClient = useQueryClient();
  const checkingRef = useRef(false);

  async function check() {
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      const persisted = await readPersisted();
      if (!persisted) return;

      const ageMs = Date.now() - persisted.lastActivityAt;
      if (ageMs <= STALE_AFTER_MS) return; // not stale yet — leave alone

      if (!persisted.eligible) {
        // Stale but below the summary threshold — silent discard. No
        // server call (the conversation row is left open; server-side
        // cleanup can prune it later if needed).
        await AsyncStorage.removeItem(ACTIVE_SESSION_KEY).catch(() => {});
        return;
      }

      // Stale + eligible — end on the server, then route to the feedback
      // modal. endSession may throw if the row is already ended; we still
      // clear storage in that case so we don't retry.
      let secondsSpoken = 0;
      try {
        const res = await endSession(persisted.conversationId);
        secondsSpoken = res.seconds_spoken ?? 0;
      } catch {
        // best-effort — server may have already ended this row
      }
      await AsyncStorage.removeItem(ACTIVE_SESSION_KEY).catch(() => {});

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["today-stats"] }),
        queryClient.invalidateQueries({ queryKey: ["progress-summary"] }),
        queryClient.invalidateQueries({ queryKey: ["current-streak"] }),
        queryClient.invalidateQueries({ queryKey: ["recent-sessions"] }),
      ]);

      router.replace({
        pathname: "/(modals)/end-of-session",
        params: {
          conversationId: persisted.conversationId,
          secondsSpoken: String(secondsSpoken),
        },
      });
    } finally {
      checkingRef.current = false;
    }
  }

  useEffect(() => {
    // Cold start: check once.
    void check();

    // Background → foreground: check again.
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") void check();
    });
    return () => sub.remove();
    // The check closure captures queryClient (stable) and module-level
    // helpers — re-running this effect on every render would be wasteful.
    // react-hooks/exhaustive-deps would flag the empty dep array; intentional.
    // (eslint-plugin-react-hooks is not loaded in this project's ESLint config)
  }, []);
}
