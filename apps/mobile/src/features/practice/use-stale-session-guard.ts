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
import { useActiveSession } from "./active-session-store";

const STALE_AFTER_MS = 5 * 60 * 1000;

async function readPersisted(): Promise<PersistedActiveSession | null> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedActiveSession;
    if (
      !parsed ||
      typeof parsed.conversationId !== "string" ||
      parsed.conversationId.length === 0 ||
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

      // Bail if the persisted conversation is the one currently mounted on the
      // Practice screen — the user is back from a >5min background but the
      // in-memory conversation is still alive. Let them resume naturally; the
      // manual end / tab-nav / fresh background will all still handle it.
      const liveId = useActiveSession.getState().conversationId;
      if (persisted.conversationId === liveId) return;

      const ageMs = Date.now() - persisted.lastActivityAt;
      if (ageMs <= STALE_AFTER_MS) return; // not stale yet

      if (!persisted.eligible) {
        // Stale but below the summary threshold — silent discard.
        await AsyncStorage.removeItem(ACTIVE_SESSION_KEY).catch(() => {});
        return;
      }

      // Stale + eligible — try to end on the server. If endSession fails
      // (offline, already ended, 5xx), we still clear local storage but DO
      // NOT navigate to the feedback modal — a modal showing secondsSpoken=0
      // and broken feedback is worse than silently dropping the recovery.
      let secondsSpoken = 0;
      let endedOk = false;
      try {
        const res = await endSession(persisted.conversationId);
        secondsSpoken = res.seconds_spoken ?? 0;
        endedOk = true;
      } catch {
        // best-effort
      }
      await AsyncStorage.removeItem(ACTIVE_SESSION_KEY).catch(() => {});
      // Also clear the in-memory active-session store so tab-press interceptors
      // stop firing the confirm dialog after a stale recovery.
      useActiveSession.getState().setConversationId(null);
      if (!endedOk) return;

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
    void check();
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (next === "active") void check();
    });
    return () => sub.remove();
    // Empty deps are intentional: check() captures queryClient (stable across
    // the QueryClientProvider lifetime) and module-level helpers; re-running
    // this effect on every render would be wasteful.
  }, []);
}
