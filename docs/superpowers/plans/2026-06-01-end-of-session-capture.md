# End-of-session capture — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make sure every meaningful conversation produces a feedback report and a coach-memory write, even when the user forgets to tap "End." Replace the header End pill with a bottom CTA, add a tab-nav confirm dialog, and add a stale-session auto-end that fires on foreground / cold start.

**Architecture:** Three converging paths (bottom CTA, tab-nav confirm, stale auto-end) all call the same `endSession(conversationId)`. The server route (`POST /sessions/:id/end`) already does feedback generation, daily-goal credit, and memory extraction (Plan 8 M1), so the mobile change is the only work. A new Zustand store carries the active-session id and a `pendingTabName` signal between the tab interceptor and the Practice screen; AsyncStorage persists `{conversationId, lastActivityAt, eligible}` across app kills.

**Tech Stack:** React Native + Expo (SDK 53), expo-router tabs, Zustand (existing convention from `auth-store.ts`), AsyncStorage (`@react-native-async-storage/async-storage`), TypeScript. No automated test runner for the mobile app — verification is manual on a real device, per spec.

**Spec:** `docs/superpowers/specs/2026-06-01-end-of-session-capture-design.md`

---

## File map

**Create:**

- `apps/mobile/src/features/practice/active-session-store.ts` — Zustand store for active-session id + pending tab nav signal.
- `apps/mobile/src/features/practice/end-session-cta.tsx` — Bottom CTA pill component.
- `apps/mobile/src/features/practice/use-stale-session-guard.ts` — Hook that checks AsyncStorage and auto-ends stale sessions on foreground / cold start.

**Modify:**

- `apps/mobile/src/features/practice/use-conversation.ts` — Track `userTurnCount`, `lastActivityAt`; persist active session to AsyncStorage; clear on `end()`.
- `apps/mobile/src/features/practice/top-status-bar.tsx` — Remove End pill + `onExit` prop.
- `apps/mobile/app/(tabs)/practice.tsx` — Drop `EndButtonCoachmark`, add `EndSessionCTA`, set active-session store, respond to `pendingTabName`, branch confirm copy on `memory_enabled`.
- `apps/mobile/app/(tabs)/_layout.tsx` — Attach `tabPress` listeners to Home/Progress/Profile that consult the store.

**Delete:**

- `apps/mobile/src/features/practice/end-button-coachmark.tsx`

---

## Task 1: Active-session Zustand store

**Files:**

- Create: `apps/mobile/src/features/practice/active-session-store.ts`

- [ ] **Step 1: Create the store**

```ts
// apps/mobile/src/features/practice/active-session-store.ts
import { create } from "zustand";

type ActiveSessionState = {
  // Set while a conversation is in flight on the Practice screen.
  // Null when no active session exists.
  conversationId: string | null;

  // When the user taps a non-Practice tab during an active session, the
  // tab-press listener writes the target tab name here. The Practice
  // screen watches this value and shows the confirm Alert. Cleared by
  // the Practice screen after the user makes a choice.
  pendingTabName: string | null;

  setConversationId: (id: string | null) => void;
  requestTabSwitch: (name: string) => void;
  clearPendingTabSwitch: () => void;
};

export const useActiveSession = create<ActiveSessionState>((set) => ({
  conversationId: null,
  pendingTabName: null,
  setConversationId: (id) => set({ conversationId: id }),
  requestTabSwitch: (name) => set({ pendingTabName: name }),
  clearPendingTabSwitch: () => set({ pendingTabName: null }),
}));
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/features/practice/active-session-store.ts
git commit -m "feat(practice): add active-session store for end-flow coordination"
```

---

## Task 2: Track turn count + last activity, persist to AsyncStorage

**Files:**

- Modify: `apps/mobile/src/features/practice/use-conversation.ts`

The hook needs to (a) bump `userTurnCount` and `lastActivityAt` after each successful user turn, (b) persist `{conversationId, lastActivityAt, eligible}` to AsyncStorage on every change, (c) clear AsyncStorage on `end()`. We also need a way for the Practice screen to read `lastActivityAt` (so it can render the CTA after the first user turn) — we expose it via the hook return.

Eligibility = `userTurnCount >= 1 && secondsSpoken >= 30`. The session timer (`useSessionTimer`) lives in `practice.tsx`; rather than re-plumb seconds back into the hook, we pass `secondsSpoken` into a `persistActive(secondsSpoken)` function exposed by the hook. The Practice screen calls it whenever the session timer ticks across the 30s threshold (or just always on each turn — see Step 4 below).

- [ ] **Step 1: Add the persistence key constant + imports**

Top of `use-conversation.ts`, add:

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export const ACTIVE_SESSION_KEY = "active-session.v1";

export type PersistedActiveSession = {
  conversationId: string;
  lastActivityAt: number; // ms epoch
  eligible: boolean;
};
```

- [ ] **Step 2: Add state for turn count + activity timestamp**

Inside `useConversation`, after the existing `useState` calls (around line 85-88), add:

```ts
const [userTurnCount, setUserTurnCount] = useState(0);
const [lastActivityAt, setLastActivityAt] = useState<number>(() => Date.now());
```

- [ ] **Step 3: Add a `persistActive` helper that the hook exposes**

Inside `useConversation` (above the `start` function), add:

```ts
// Called by the Practice screen after each turn and on the session-timer
// 30s threshold so the persisted "eligible" flag reflects the current
// seconds spoken. The screen knows secondsSpoken; the hook knows turn count.
async function persistActive(secondsSpoken: number) {
  const id = conversationIdRef.current;
  if (!id) return;
  const eligible = userTurnCount >= 1 && secondsSpoken >= 30;
  const payload: PersistedActiveSession = {
    conversationId: id,
    lastActivityAt: Date.now(),
    eligible,
  };
  try {
    await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(payload));
  } catch {
    // best-effort — persistence failure should not break the conversation
  }
}
```

- [ ] **Step 4: Bump `userTurnCount` + `lastActivityAt` when a user turn lands**

In the `for await (const event of events)` loop inside `stop()` (around line 245), find the `event.type === "transcription"` branch. Right after the `setMessages` call that appends the user message, add:

```ts
} else if (event.type === "transcription") {
  setMessages((prev) => [
    ...prev,
    {
      id: `u-${Date.now()}`,
      role: "user",
      text: event.text,
      audioUrl: uri,
      audioDurationMs: durationMs,
    },
  ]);
  setUserTurnCount((n) => n + 1);
  setLastActivityAt(Date.now());
```

And in the `"reply-chunk"` branch (when the coach reply finishes), bump `lastActivityAt` only — coach turns are activity but don't count toward eligibility. After the `audioQueue.enqueue` call inside `"reply-chunk"`, add at the end of the branch:

```ts
setLastActivityAt(Date.now());
```

(If `setLastActivityAt` inside a chunk-by-chunk loop is too noisy, you can also bump it once on the `"done"` event — either way is fine. The point is: by the time the turn is done, `lastActivityAt` is fresh.)

- [ ] **Step 5: Clear AsyncStorage on `end()`**

Replace the `end()` function (currently lines 333-344) with:

```ts
async function end(): Promise<{
  conversationId: string | null;
  secondsSpoken: number;
}> {
  const conversationId = conversationIdRef.current;
  if (!conversationId) {
    await AsyncStorage.removeItem(ACTIVE_SESSION_KEY).catch(() => {});
    return { conversationId: null, secondsSpoken: 0 };
  }
  const result = await endSession(conversationId);
  await AsyncStorage.removeItem(ACTIVE_SESSION_KEY).catch(() => {});
  return {
    conversationId,
    secondsSpoken: result.seconds_spoken ?? 0,
  };
}
```

- [ ] **Step 6: Expose new fields from the hook return**

Find the `return` block of `useConversation` (search for the existing return that includes `state, messages, listeningMode, ...`). Add `userTurnCount`, `lastActivityAt`, and `persistActive`:

```ts
return {
  state,
  messages,
  listeningMode,
  revealedIds,
  userTurnCount,
  lastActivityAt,
  persistActive,
  start,
  stop,
  end,
  dismissError,
  toggleListeningMode,
  revealMessage,
};
```

- [ ] **Step 7: Verify by running the type-check**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS. If failures appear in `practice.tsx` complaining about missing properties, that's expected — Task 5 fixes that.

If failures appear elsewhere, fix the type signatures inline.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/features/practice/use-conversation.ts
git commit -m "feat(practice): track userTurnCount + lastActivityAt, persist active session"
```

---

## Task 3: EndSessionCTA component

**Files:**

- Create: `apps/mobile/src/features/practice/end-session-cta.tsx`

- [ ] **Step 1: Write the component**

```tsx
// apps/mobile/src/features/practice/end-session-cta.tsx
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { EditorialText, GlassCard } from "@/src/design";
import { palette, spacing } from "@language-coach/design-tokens";

type Props = {
  visible: boolean;
  onPress: () => void;
};

export function EndSessionCTA({ visible, onPress }: Props) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(visible ? 0 : 8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: visible ? 0 : 8,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacity, translateY]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.wrapper, { opacity, transform: [{ translateY }] }]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <Pressable
        onPress={onPress}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="End conversation and see feedback"
      >
        <GlassCard radiusToken="pill" padding="sm" style={styles.pill}>
          <EditorialText kind="bodySm" color={palette.ink} style={styles.label}>
            End & see feedback
          </EditorialText>
          <Ionicons name="chevron-forward" size={14} color={palette.ink} />
        </GlassCard>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
  },
  label: {
    fontWeight: "600",
  },
});
```

- [ ] **Step 2: Verify by running the type-check**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS for this file. (Practice screen may still fail until Task 5; that's OK.)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/practice/end-session-cta.tsx
git commit -m "feat(practice): add EndSessionCTA pill component"
```

---

## Task 4: Remove End pill from TopStatusBar

**Files:**

- Modify: `apps/mobile/src/features/practice/top-status-bar.tsx`

- [ ] **Step 1: Drop the `onExit` prop, the End pill JSX, and the related styles**

Replace the existing file with:

```tsx
// apps/mobile/src/features/practice/top-status-bar.tsx
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import { EditorialText, GlassCard } from "@/src/design";
import { palette, spacing } from "@language-coach/design-tokens";
import { ShareButton } from "./share-button";
import type { TranscriptMessage } from "./build-transcript";
import avatarLottie from "../../../assets/avatar.json";

type Props = {
  todaySeconds: number;
  goalMinutes: number;
  streakDays: number;
  listeningMode: boolean;
  onToggleListening: () => void;
  shareLanguageCode: string;
  shareStartedAt: Date;
  shareDurationMinutes: number;
  shareMessages: TranscriptMessage[];
};

function formatMinSec(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TopStatusBar(props: Props) {
  const insets = useSafeAreaInsets();
  const goalSec = props.goalMinutes * 60;
  const goalHit = props.todaySeconds >= goalSec && goalSec > 0;
  const todayDisplay = formatMinSec(props.todaySeconds);
  const goalDisplay = `${props.goalMinutes}:00`;

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        { top: insets.top + spacing.sm, left: spacing.lg, right: spacing.lg },
      ]}
    >
      {/* Left: animated avatar + timer pill */}
      <GlassCard radiusToken="pill" padding="sm" style={styles.timerPill}>
        <LottieView source={avatarLottie} autoPlay loop style={styles.avatar} />
        <EditorialText
          kind="bodyMd"
          color={goalHit ? palette.accent : palette.ink}
          style={styles.timerText}
        >
          {todayDisplay}
        </EditorialText>
        <EditorialText kind="bodySm" color={palette.inkSoft}>
          {`/ ${goalDisplay}`}
        </EditorialText>
      </GlassCard>

      {/* Right: listening toggle + share. End pill removed — moved to a
          bottom CTA + auto-save flow (see EndSessionCTA + use-stale-session-guard). */}
      <View style={styles.rightRow}>
        <Pressable onPress={props.onToggleListening} hitSlop={8}>
          <GlassCard radiusToken="pill" padding="xs" style={styles.iconButton}>
            <Ionicons
              name={props.listeningMode ? "headset" : "eye-outline"}
              size={16}
              color={props.listeningMode ? palette.accent : palette.ink}
            />
          </GlassCard>
        </Pressable>

        <ShareButton
          languageCode={props.shareLanguageCode}
          startedAt={props.shareStartedAt}
          durationMinutes={props.shareDurationMinutes}
          messages={props.shareMessages}
        />
      </View>
    </View>
  );
}
```

Then keep the existing `StyleSheet.create` block from the original file but **delete** the `endButton` and `endLabel` style entries (they're no longer referenced). Leave `wrapper`, `timerPill`, `avatar`, `timerText`, `rightRow`, `iconButton` as they were.

- [ ] **Step 2: Verify by running the type-check**

Run: `cd apps/mobile && pnpm typecheck`
Expected: `practice.tsx` will fail because it still passes `onExit` — that's expected; Task 5 fixes it.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/practice/top-status-bar.tsx
git commit -m "feat(practice): remove End pill from TopStatusBar"
```

---

## Task 5: Wire CTA, confirm flow, and store into Practice screen

**Files:**

- Modify: `apps/mobile/app/(tabs)/practice.tsx`

This is the biggest task. It:

1. Drops the `EndButtonCoachmark` import + render.
2. Drops `onExit` from the `<TopStatusBar>` props.
3. Imports + renders `<EndSessionCTA>`.
4. Pulls the existing `onExit` Alert body into a single `confirmAndEnd()` function that branches its body copy on `profile.memory_enabled`.
5. Sets `useActiveSession.setConversationId(...)` when an active session exists, clears on unmount or end.
6. Watches `useActiveSession.pendingTabName` and shows the confirm Alert when it becomes set.
7. Replaces `persistActive` calls from the hook to keep AsyncStorage fresh.

- [ ] **Step 1: Update imports**

At the top of `practice.tsx`, replace the existing import block for practice features with:

```ts
import { stopActivePlayer } from "@/src/features/practice/audio-controller";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/src/features/auth/use-profile";
import { useAudioSessionInit } from "@/src/lib/audio-session";
import { useConversation } from "@/src/features/practice/use-conversation";
import type { ChatMessage } from "@/src/features/practice/types";
import { MessageBubble } from "@/src/features/practice/MessageBubble";
import { MicButton } from "@/src/features/practice/MicButton";
import { TopStatusBar } from "@/src/features/practice/top-status-bar";
import { EndSessionCTA } from "@/src/features/practice/end-session-cta";
import { useSessionTimer } from "@/src/features/practice/use-session-timer";
import { useGoalReward } from "@/src/features/practice/use-goal-reward";
import { GoalReward } from "@/src/features/practice/goal-reward";
import { useTodayStats } from "@/src/features/home/use-today-stats";
import {
  useRecentSessions,
  type RecentSession,
} from "@/src/features/practice/use-recent-sessions";
import { supabase } from "@/src/lib/supabase";
import { useActiveSession } from "@/src/features/practice/active-session-store";
```

(Note: the `EndButtonCoachmark` import is gone.)

- [ ] **Step 2: Pull `memory_enabled` from the profile**

Inside `ActiveConversation`, after the existing `const goalMinutes = profile?.daily_goal_minutes ?? 10;` line, add:

```ts
const memoryEnabled = profile?.memory_enabled ?? false;
```

(If `memory_enabled` isn't on the `useProfile()` return type, add it to the type — it's on the DB row already. Check `apps/mobile/src/features/auth/use-profile.ts`.)

- [ ] **Step 3: Destructure the new hook returns**

Update the `useConversation` destructure to:

```ts
const {
  state,
  messages,
  listeningMode,
  revealedIds,
  userTurnCount,
  persistActive,
  start,
  stop,
  end,
  dismissError,
  toggleListeningMode,
  revealMessage,
} = useConversation(targetLang, displayName, nativeLang, scenarioId);
```

- [ ] **Step 4: Set + clear the active-session store**

After the existing `useFocusEffect` block (around line 263-271), add:

```ts
const setActiveConversationId = useActiveSession((s) => s.setConversationId);

useEffect(() => {
  // state.conversationId is set as soon as startSession resolves
  const id =
    state.phase === "idle" ||
    state.phase === "recording" ||
    state.phase === "processing"
      ? state.conversationId
      : null;
  setActiveConversationId(id);
  return () => setActiveConversationId(null);
}, [state, setActiveConversationId]);
```

- [ ] **Step 5: Call `persistActive` on each session-timer tick over a 30s boundary**

After the `useSessionTimer` line, add:

```ts
// Persist current state to AsyncStorage so the stale-session guard can
// recover this session on the next foreground / cold start. Re-persist on
// every turn (userTurnCount change) and once the timer crosses 30s.
useEffect(() => {
  if (state.phase === "loading-session" || state.phase === "error") return;
  void persistActive(sessionSeconds);
}, [
  userTurnCount,
  sessionSeconds >= 30,
  state.phase,
  persistActive,
  sessionSeconds,
]);
```

(The intent is: persist on every turn, and once when the 30s threshold is crossed so `eligible` flips to true. The dependency `sessionSeconds >= 30` is fine — it changes value exactly once at the threshold. Some linters will warn about boolean dependencies; add `// eslint-disable-next-line react-hooks/exhaustive-deps` if needed.)

- [ ] **Step 6: Replace `onExit` with a `confirmAndEnd` that runs the same flow**

Find the existing `onExit` function (around line 316-364). Rename it to `confirmAndEnd` and parameterize the body copy on `memoryEnabled`. The implementation stays identical otherwise — same Alert, same `end()` call, same query invalidation, same `router.replace` to the feedback modal:

```ts
const confirmAndEnd = useCallback(() => {
  const body = memoryEnabled
    ? "Your coach will prepare a feedback report — your highlights, things to polish, and new vocabulary worth remembering. Plus your coach will remember what matters from this chat next time. Your practice time also goes toward your daily goal and streak."
    : "Your coach will prepare a feedback report — your highlights, things to polish, and new vocabulary worth remembering. Your practice time also goes toward your daily goal and streak.";

  Alert.alert("End conversation?", body, [
    { text: "Keep talking", style: "cancel" },
    {
      text: "End & see feedback",
      style: "default",
      onPress: () => {
        void (async () => {
          let endResult: {
            conversationId: string | null;
            secondsSpoken: number;
          } | null = null;
          try {
            endResult = await end();
          } catch {
            /* best-effort */
          }
          resetSessionTimer();
          todaySecondsAtStartRef.current = 0;
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["today-stats"] }),
            queryClient.invalidateQueries({ queryKey: ["progress-summary"] }),
            queryClient.invalidateQueries({ queryKey: ["current-streak"] }),
            queryClient.invalidateQueries({ queryKey: ["recent-sessions"] }),
          ]);
          if (endResult?.conversationId) {
            router.replace({
              pathname: "/(modals)/end-of-session",
              params: {
                conversationId: endResult.conversationId,
                secondsSpoken: String(endResult.secondsSpoken),
              },
            });
          } else {
            router.replace("/(tabs)/practice");
          }
        })();
      },
    },
  ]);
}, [memoryEnabled, end, queryClient, resetSessionTimer]);
```

(`useCallback` import already exists at the top of the file.)

- [ ] **Step 7: Watch `pendingTabName` and show confirm with tab-leave branch**

After the `confirmAndEnd` definition, add:

```ts
const pendingTabName = useActiveSession((s) => s.pendingTabName);
const clearPendingTabSwitch = useActiveSession((s) => s.clearPendingTabSwitch);

useEffect(() => {
  if (!pendingTabName) return;
  const target = pendingTabName;
  const body = memoryEnabled
    ? "Your coach will prepare a feedback report — your highlights, things to polish, and new vocabulary worth remembering. Plus your coach will remember what matters from this chat next time. Your practice time also goes toward your daily goal and streak."
    : "Your coach will prepare a feedback report — your highlights, things to polish, and new vocabulary worth remembering. Your practice time also goes toward your daily goal and streak.";

  Alert.alert("End conversation?", body, [
    {
      text: "Just leave",
      style: "cancel",
      onPress: () => {
        clearPendingTabSwitch();
        router.push(`/(tabs)/${target}`);
      },
    },
    {
      text: "End & see feedback",
      style: "default",
      onPress: () => {
        clearPendingTabSwitch();
        // Reuse the same end flow. After endSession lands the user on the
        // end-of-session modal, dismissing the modal returns them to
        // Practice — they then have to tap their target tab again. That's
        // acceptable: the feedback is the priority.
        void (async () => {
          let endResult: {
            conversationId: string | null;
            secondsSpoken: number;
          } | null = null;
          try {
            endResult = await end();
          } catch {
            /* best-effort */
          }
          resetSessionTimer();
          todaySecondsAtStartRef.current = 0;
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["today-stats"] }),
            queryClient.invalidateQueries({ queryKey: ["progress-summary"] }),
            queryClient.invalidateQueries({ queryKey: ["current-streak"] }),
            queryClient.invalidateQueries({ queryKey: ["recent-sessions"] }),
          ]);
          if (endResult?.conversationId) {
            router.replace({
              pathname: "/(modals)/end-of-session",
              params: {
                conversationId: endResult.conversationId,
                secondsSpoken: String(endResult.secondsSpoken),
              },
            });
          } else {
            router.replace(`/(tabs)/${target}`);
          }
        })();
      },
    },
  ]);
}, [
  pendingTabName,
  memoryEnabled,
  end,
  queryClient,
  resetSessionTimer,
  clearPendingTabSwitch,
]);
```

- [ ] **Step 8: Drop `<TopStatusBar onExit={onExit}>` and `<EndButtonCoachmark />`; add `<EndSessionCTA>`**

Find the return JSX (the `return (<Screen variant="gradient" edgeToEdge>...` block). Make these three changes:

(a) The `<TopStatusBar ... onExit={onExit} />` becomes `<TopStatusBar ... />` (drop the `onExit` line).

(b) Delete the `<EndButtonCoachmark />` line entirely.

(c) Inside the `micBar` `View`, immediately before `<MicButton ... />`, add:

```tsx
<EndSessionCTA visible={userTurnCount >= 1} onPress={confirmAndEnd} />
```

So the relevant chunk looks like:

```tsx
<View style={[activeStyles.micBar, { bottom: micBarBottom }]}>
  {state.phase === "processing" && (
    <GlassCard
      radiusToken="pill"
      padding="sm"
      style={activeStyles.processingPill}
    >
      <ActivityIndicator size="small" color={palette.accent} />
      <EditorialText kind="bodySm" color={palette.inkSoft}>
        Coach is thinking…
      </EditorialText>
    </GlassCard>
  )}
  <EndSessionCTA visible={userTurnCount >= 1} onPress={confirmAndEnd} />
  <MicButton onPress={onMicPress} isRecording={isRecording} isBusy={isBusy} />
</View>
```

- [ ] **Step 9: Verify by running the type-check + lint**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint`
Expected: PASS. If lint complains about the `sessionSeconds >= 30` dependency in Step 5, add an eslint-disable comment as noted.

- [ ] **Step 10: Commit**

```bash
git add apps/mobile/app/\(tabs\)/practice.tsx
git commit -m "feat(practice): wire EndSessionCTA + active-session store + memory-aware confirm copy"
```

---

## Task 6: Delete the old end-button coachmark

**Files:**

- Delete: `apps/mobile/src/features/practice/end-button-coachmark.tsx`

- [ ] **Step 1: Confirm no remaining references**

Run: `cd apps/mobile && grep -r "EndButtonCoachmark\|end-button-coachmark" src app`
Expected: no matches (Task 5 already removed the import + render).

If there are remaining references, fix them before deleting the file.

- [ ] **Step 2: Delete the file**

```bash
rm apps/mobile/src/features/practice/end-button-coachmark.tsx
```

- [ ] **Step 3: Verify by running the type-check**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A apps/mobile/src/features/practice/end-button-coachmark.tsx
git commit -m "chore(practice): remove orphaned EndButtonCoachmark"
```

---

## Task 7: Stale-session guard hook

**Files:**

- Create: `apps/mobile/src/features/practice/use-stale-session-guard.ts`

The hook reads AsyncStorage, checks staleness + eligibility, and either calls `endSession` + routes to the feedback modal, or silently clears storage.

- [ ] **Step 1: Write the hook**

```ts
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
```

- [ ] **Step 2: Verify by running the type-check**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/features/practice/use-stale-session-guard.ts
git commit -m "feat(practice): add stale-session guard hook"
```

---

## Task 8: Mount stale guard + tab-press interceptors in tabs layout

**Files:**

- Modify: `apps/mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Replace the file**

```tsx
// apps/mobile/app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import { TabBar } from "@/src/design";
import { useActiveSession } from "@/src/features/practice/active-session-store";
import { useStaleSessionGuard } from "@/src/features/practice/use-stale-session-guard";

export default function TabsLayout() {
  // Fires on first entry into the tab area (post-auth, post-onboarding) and
  // on every return-to-foreground while the tabs are mounted.
  useStaleSessionGuard();

  // Intercept tab presses on non-Practice tabs when an active conversation
  // exists; the Practice screen watches `pendingTabName` and shows the
  // confirm Alert.
  const makeInterceptor = (tabName: string) => ({
    tabPress: (e: { preventDefault: () => void }) => {
      const s = useActiveSession.getState();
      if (!s.conversationId) return; // no active session — let the press go
      e.preventDefault();
      s.requestTabSwitch(tabName);
    },
  });

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Home" }}
        listeners={makeInterceptor("home")}
      />
      <Tabs.Screen name="practice" options={{ title: "Practice" }} />
      <Tabs.Screen
        name="progress"
        options={{ title: "Progress" }}
        listeners={makeInterceptor("progress")}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile" }}
        listeners={makeInterceptor("profile")}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: Verify by running the type-check + lint**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint`
Expected: PASS. If `listeners` types are stricter than the `{preventDefault}` shape, import the proper navigation event type from `@react-navigation/native` (`BottomTabNavigationEventMap`) and refine.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/\(tabs\)/_layout.tsx
git commit -m "feat(practice): intercept tab nav + mount stale-session guard"
```

---

## Task 9: Manual verification on a dev build

**Files:** none — this is a verification pass.

There are no automated tests for this flow; the spec's verification plan is the source of truth. Run through it on a real Android device (Bruno's primary test device) using a dev build.

- [ ] **Step 1: Start the dev build**

Run: `cd apps/mobile && pnpm dev:android` (or whatever Bruno's standard dev-build command is — see `apps/mobile/DEV.md`).

- [ ] **Step 2: Walk the 10-point verification checklist**

From the spec (`docs/superpowers/specs/2026-06-01-end-of-session-capture-design.md`, section "Verification plan"):

1. **CTA appears at the right time** — start free conv, CTA hidden in greeting, appears after 1st turn.
2. **Manual end (bottom CTA)** — tap CTA → alert → confirm → modal opens. Confirm a memory row was written for this user × target_lang (psql / Supabase studio).
3. **Tab-nav "End & see feedback"** — mid-conv, tap Home tab → alert → confirm → modal opens.
4. **Tab-nav "Just leave"** — tap Home → "Just leave" → Home tab opens, session preserved. Return to Practice → conversation still there.
5. **Stale auto-end, foreground** — background app 6 min → return → modal opens automatically. AsyncStorage key cleared.
6. **Stale auto-end, cold start** — force-stop app, wait 6 min, open → modal opens automatically.
7. **Stale but ineligible** — fresh conversation, no speaking, background 6 min, return → no modal, storage cleared.
8. **Sub-threshold manual end** — fresh conv, CTA hidden, tab-nav → "End & see feedback" → modal opens with thin/empty feedback (server should handle gracefully).
9. **Header is clean** — no End pill, listening + share still work.
10. **Memory write on every end path** — for (2), (3), (5), (6), confirm a `coach_memory` row exists/was updated for the user × target_lang (with `memory_enabled = true` profile).

- [ ] **Step 3: If issues found, file each as a follow-up commit and add notes to this plan inline**

- [ ] **Step 4: Final commit (only if any cleanup was needed)**

```bash
git add -A
git commit -m "chore(practice): post-verification fixes"
```

---

## Notes on conventions

- **No TDD here.** The mobile app has no automated test runner; the spec's manual verification is the test plan.
- **`pnpm typecheck` + `pnpm lint` are the CI gates.** Per Bruno's standing instruction (memory: "always keep CI green"), run both before every push to main. If you push intermediate work, push to a feature branch.
- **AsyncStorage key versioning.** The `.v1` suffix on `ACTIVE_SESSION_KEY` lets future shape changes coexist with old persisted entries (read-and-discard on shape mismatch is already handled in `readPersisted`).
- **No backend changes.** The server-side `/sessions/:id/end` already does feedback generation, daily-goal credit, and memory extraction (Plan 8 M1). This is mobile-only work.
