import { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  EditorialText,
  GlassCard,
  Screen,
  TAB_BAR_RESERVE,
} from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";
import { LANGUAGES, ROLE_PLAY_SCENARIOS } from "@language-coach/shared";
import {
  resumePlayback,
  stopAllPlayback,
} from "@/src/features/practice/audio-controller";
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
import { LiveConversation } from "@/src/features/practice/live-conversation";
import { useVoiceModeSetting } from "@/src/features/practice/use-voice-mode-setting";
import { useAllowedVoiceModes } from "@/src/features/practice/use-allowed-voice-modes";

function useCurrentStreak() {
  return useQuery<number>({
    queryKey: ["current-streak"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("current_streak");
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
}

// PracticeScreen is the top-level tab. It decides between two modes:
// - Chooser: shown when no scenarioId and start !== "free" — lets the
//   user pick scenario, free conversation, or review past feedback.
// - Active: the existing conversation UI (mic, message stream, etc.) —
//   mounts a fresh session via useConversation, keyed on params so
//   picking a new scenario tears down the old session cleanly.
export default function PracticeScreen() {
  const { scenarioId: urlScenarioId, start: urlStart } = useLocalSearchParams<{
    scenarioId?: string;
    start?: string;
  }>();
  // Prefer in-memory active-session params over URL state. After the user
  // chose "Just leave" on a tab-nav popup, router.push to a sibling tab wipes
  // the Practice tab's URL params; on return the URL is bare. Without this
  // fallback we'd render the chooser and lose the live conversation.
  const stored = useActiveSession((s) => s.activeStartParams);
  const setCurrentTab = useActiveSession((s) => s.setCurrentTab);
  const scenarioId = urlScenarioId ?? stored?.scenarioId;
  const start = urlStart ?? stored?.start;
  const isActive = !!scenarioId || start === "free";

  // Track that the user is on the Practice tab. Used by the tab interceptors
  // in (tabs)/_layout.tsx so the popup only fires when leaving Practice,
  // not between unrelated tabs like Progress -> Profile.
  useFocusEffect(
    useCallback(() => {
      setCurrentTab("practice");
      return () => setCurrentTab(null);
    }, [setCurrentTab]),
  );

  // Voice mode (push-to-talk vs Live). Live is gated server-side; when the user
  // has selected it AND is entitled, render the Live flow instead of the
  // push-to-talk ActiveConversation (which is otherwise untouched).
  const { mode: voiceMode, loaded: voiceModeLoaded } = useVoiceModeSetting();
  const { data: allowedModes } = useAllowedVoiceModes();
  const canLive = allowedModes?.voiceModes.includes("live") ?? false;

  if (!isActive) {
    return <PracticeChooser />;
  }
  // key forces a fresh session when scenarioId changes — picking a new scenario
  // mid-day should not reuse a stale conversation_id.
  const k = scenarioId ?? "free";
  if (voiceModeLoaded && voiceMode === "live" && canLive) {
    return <LiveConversation key={`live-${k}`} scenarioId={scenarioId} />;
  }
  return <ActiveConversation key={k} scenarioId={scenarioId} />;
}

// ============================================================
// Chooser
// ============================================================

function PracticeChooser() {
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const nativeLang = (profile?.native_lang ?? "en") as "en" | "fr";
  const { data, isLoading } = useRecentSessions();
  const { mode: voiceMode, setMode: setVoiceMode } = useVoiceModeSetting();
  const { data: allowedModes } = useAllowedVoiceModes();
  const canLive = allowedModes?.voiceModes.includes("live") ?? false;

  const onScenario = () => router.push("/(modals)/role-play-picker");
  const onFree = () => router.replace("/(tabs)/practice?start=free");
  const onReview = (id: string, secondsSpoken: number) =>
    router.push({
      pathname: "/(modals)/end-of-session",
      params: { conversationId: id, secondsSpoken: String(secondsSpoken) },
    });

  return (
    <Screen variant="gradient">
      <ScrollView
        contentContainerStyle={[
          chooserStyles.scroll,
          { paddingTop: insets.top + spacing.lg },
        ]}
      >
        <EditorialText kind="displayMd" italic style={chooserStyles.title}>
          What do you want to do?
        </EditorialText>
        <EditorialText
          kind="bodyMd"
          color={palette.inkSoft}
          style={chooserStyles.subtitle}
        >
          Talk to your coach about anything, or step into a real-life scenario
          and practice with someone in role.
        </EditorialText>

        {canLive && (
          <View
            style={{
              flexDirection: "row",
              gap: spacing.md,
              marginBottom: spacing.lg,
            }}
          >
            {(["push_to_talk", "live"] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => void setVoiceMode(m)}
                style={{
                  flex: 1,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.lg,
                  alignItems: "center",
                  backgroundColor:
                    voiceMode === m ? palette.accent : "rgba(0,0,0,0.06)",
                }}
              >
                <EditorialText kind="bodySm">
                  {m === "live" ? "⚡ Live (beta)" : "Push-to-talk"}
                </EditorialText>
              </Pressable>
            ))}
          </View>
        )}

        {/* Free conversation first — main functionality. */}
        <Pressable onPress={onFree} style={chooserStyles.card}>
          <EditorialText kind="bodyMd" style={chooserStyles.cardTitle}>
            💬 Free conversation with your language coach
          </EditorialText>
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            Lisa talks with you about anything — she&apos;ll gently correct
            grammar and vocabulary as you go.
          </EditorialText>
        </Pressable>

        <Pressable onPress={onScenario} style={chooserStyles.card}>
          <EditorialText kind="bodyMd" style={chooserStyles.cardTitle}>
            🎭 Practice a scenario
          </EditorialText>
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            Real-life conversation with a stranger — at the café, the doctor, a
            job interview. They&apos;re not there to teach you, but they can be
            friendly.
          </EditorialText>
        </Pressable>

        <EditorialText
          kind="bodySm"
          color={palette.inkSoft}
          style={chooserStyles.historyHeader}
        >
          Recent sessions
        </EditorialText>

        {isLoading && (
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            Loading…
          </EditorialText>
        )}

        {data && data.sessions.length === 0 && (
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            No completed sessions yet. Have your first conversation above.
          </EditorialText>
        )}

        {data?.sessions.map((s) => (
          <RecentSessionRow
            key={s.id}
            session={s}
            nativeLang={nativeLang}
            onPress={() => onReview(s.id, s.secondsSpoken)}
          />
        ))}

        <View
          style={{ height: insets.bottom + TAB_BAR_RESERVE + spacing.lg }}
        />
      </ScrollView>
    </Screen>
  );
}

function RecentSessionRow({
  session,
  nativeLang,
  onPress,
}: {
  session: RecentSession;
  nativeLang: "en" | "fr";
  onPress: () => void;
}) {
  const lang = LANGUAGES.find((l) => l.code === session.language);
  const scenario = session.scenarioId
    ? ROLE_PLAY_SCENARIOS.find((s) => s.id === session.scenarioId)
    : null;
  const langName = lang?.englishName ?? session.language;
  const scenarioTitle = scenario?.title[nativeLang] ?? scenario?.title.en;
  const min = Math.floor(session.secondsSpoken / 60);
  const sec = session.secondsSpoken % 60;
  const when = session.endedAt
    ? new Date(session.endedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";
  const status = session.feedbackStatus;
  const statusLabel =
    status === "ready"
      ? "View feedback →"
      : status === "pending"
        ? "Feedback preparing…"
        : status === "failed"
          ? "Feedback unavailable"
          : "Open →";

  return (
    <Pressable onPress={onPress} style={chooserStyles.historyRow}>
      <View style={{ flex: 1 }}>
        <EditorialText kind="bodyMd" style={chooserStyles.historyTitle}>
          {scenarioTitle ?? `${langName} conversation`}
        </EditorialText>
        <EditorialText kind="bodySm" color={palette.inkSoft}>
          {when} · {min} min {sec > 0 ? `${sec} sec` : ""}
        </EditorialText>
      </View>
      <EditorialText kind="bodySm" color={palette.accent}>
        {statusLabel}
      </EditorialText>
    </Pressable>
  );
}

// ============================================================
// Active conversation
// ============================================================

function ActiveConversation({ scenarioId }: { scenarioId?: string }) {
  useAudioSessionInit();
  const insets = useSafeAreaInsets();
  const micBarBottom = insets.bottom + TAB_BAR_RESERVE;
  const { data: profile } = useProfile();
  const targetLang = profile?.target_lang ?? "en";
  const displayName = profile?.display_name ?? "there";
  const nativeLang = profile?.native_lang ?? "en";
  const goalMinutes = profile?.daily_goal_minutes ?? 10;
  // TODO: add memory_enabled to the generated Supabase profile type when types
  // are regenerated. Until then, cast to avoid any implicit-any lint error.
  const memoryEnabled =
    (profile as { memory_enabled?: boolean } | undefined)?.memory_enabled ??
    false;

  const [startedAt] = useState<Date>(() => new Date());

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

  const { data: todayStats } = useTodayStats();
  const { data: streak } = useCurrentStreak();
  const queryClient = useQueryClient();

  const [isFocused, setIsFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      // Re-enable playback whenever we return to Practice (it was latched off
      // on the last blur).
      resumePlayback();
      return () => {
        setIsFocused(false);
        // Hard-stop playback AND latch it off so no queued/streaming chunk leaks
        // past navigation (tab switch or a modal pushed over us).
        stopAllPlayback();
      };
    }, []),
  );

  const setActive = useActiveSession((s) => s.setActive);
  const clearActive = useActiveSession((s) => s.clearActive);

  const activeConversationId =
    state.phase === "idle" ||
    state.phase === "recording" ||
    state.phase === "processing"
      ? state.conversationId
      : null;

  useEffect(() => {
    if (activeConversationId) {
      // Capture both the conversation id and the URL params so the Practice
      // tab interceptor can restore the right route after a "Just leave".
      setActive(activeConversationId, {
        scenarioId,
        start: scenarioId ? undefined : "free",
      });
    } else {
      clearActive();
    }
    return () => clearActive();
  }, [activeConversationId, scenarioId, setActive, clearActive]);

  const sessionActive =
    isFocused &&
    (state.phase === "idle" ||
      state.phase === "recording" ||
      state.phase === "processing");
  const { seconds: sessionSeconds, reset: resetSessionTimer } =
    useSessionTimer(sessionActive);

  // Persist current state to AsyncStorage so the stale-session guard can
  // recover this session on next foreground / cold start. Re-persist when
  // userTurnCount changes or when sessionSeconds crosses the 30s eligibility
  // threshold (the boolean flips exactly once and triggers a single refresh).
  useEffect(() => {
    if (state.phase === "loading-session" || state.phase === "error") return;
    void persistActive(sessionSeconds);
    // Intentional: deps include the boolean `sessionSeconds >= 30` (flips once)
    // and `userTurnCount` (fires on each user turn). Raw `sessionSeconds` is
    // deliberately excluded so we don't persist on every timer tick.
  }, [userTurnCount, sessionSeconds >= 30, state.phase, persistActive]);

  const todaySecondsAtStartRef = useRef(0);
  useEffect(() => {
    if (todayStats && todaySecondsAtStartRef.current === 0) {
      todaySecondsAtStartRef.current = todayStats.secondsSpoken ?? 0;
    }
  }, [todayStats]);

  const todaySeconds = todaySecondsAtStartRef.current + sessionSeconds;
  const goalSeconds = goalMinutes * 60;
  const alreadyReachedToday = todayStats?.goalReached ?? false;

  const { triggered: rewardTriggered, dismiss: dismissReward } = useGoalReward({
    todaySeconds,
    goalSeconds,
    alreadyReachedToday,
  });

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  const [listHeight, setListHeight] = useState(0);
  // Track the live message count so the scroll helper can run from callbacks
  // (onContentSizeChange) without going stale.
  const msgCountRef = useRef(0);
  msgCountRef.current = messages.length;

  // Autoscroll — the app keeps the newest message centered on screen on its own;
  // the user never scrolls. We ask FlatList to place the LAST row at the vertical
  // center (viewPosition 0.5). This is deterministic and identical for user and
  // coach messages: it doesn't depend on measuring total content height (which is
  // unreliable on a virtualized list of variable-height bubbles once the thread
  // fills the screen) and it doesn't care whether the message arrived all at once
  // (user transcript) or grew chunk-by-chunk (streaming coach reply). The bottom
  // spacer (see paddingBottom below) gives the list room to lift the last row all
  // the way up to the center. onScrollToIndexFailed re-tries once the row is laid
  // out.
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const centerLatest = useCallback(() => {
    const n = msgCountRef.current;
    if (n === 0) return;
    flatListRef.current?.scrollToIndex({
      index: n - 1,
      viewPosition: 0.5,
      animated: true,
    });
    // Settle: re-assert the centered position after content/layout stops
    // changing. On Android the immediate scroll fired during a streaming reply
    // lands before the final bubble height is known, leaving the message low
    // (it stayed near the bottom on a Samsung device); this re-center after a
    // beat lifts it to the middle. Debounced — each growth resets the timer, so
    // only the final size triggers it. Harmless on iOS (re-asserts same spot).
    if (settleRef.current) clearTimeout(settleRef.current);
    settleRef.current = setTimeout(() => {
      const m = msgCountRef.current;
      if (m === 0) return;
      flatListRef.current?.scrollToIndex({
        index: m - 1,
        viewPosition: 0.5,
        animated: true,
      });
    }, 250);
  }, []);

  useEffect(
    () => () => {
      if (settleRef.current) clearTimeout(settleRef.current);
    },
    [],
  );

  // Re-center when a message is added. onContentSizeChange covers a streaming
  // reply that grows in place; this covers the append itself, with a frame's
  // delay so the new row has mounted before we scroll.
  useEffect(() => {
    if (messages.length === 0) return;
    const id = setTimeout(centerLatest, 50);
    return () => clearTimeout(id);
  }, [messages.length, centerLatest]);

  const isBusy =
    state.phase === "processing" || state.phase === "loading-session";
  const isRecording = state.phase === "recording";

  const onMicPress = () => {
    if (state.phase === "idle") void start();
    else if (state.phase === "recording") void stop();
  };

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
          // Clear the active-session store synchronously so the tab-press
          // interceptors in (tabs)/_layout.tsx stop intercepting. The effect
          // cleanup that nulls the store only fires on unmount or when
          // activeConversationId changes — neither happens just from
          // router.replace to a modal, so without this clear the popup keeps
          // firing on every subsequent tab navigation.
          clearActive();
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
  }, [memoryEnabled, end, queryClient, resetSessionTimer, clearActive]);

  const pendingTabName = useActiveSession((s) => s.pendingTabName);
  const clearPendingTabSwitch = useActiveSession(
    (s) => s.clearPendingTabSwitch,
  );

  useEffect(() => {
    if (!pendingTabName) return;
    const target = pendingTabName;
    // Clear the trigger BEFORE showing the Alert so this effect doesn't
    // re-fire and stack a second dialog if any other dep changes while
    // the user is still deciding.
    clearPendingTabSwitch();
    const body = memoryEnabled
      ? "Your coach will prepare a feedback report — your highlights, things to polish, and new vocabulary worth remembering. Plus your coach will remember what matters from this chat next time. Your practice time also goes toward your daily goal and streak."
      : "Your coach will prepare a feedback report — your highlights, things to polish, and new vocabulary worth remembering. Your practice time also goes toward your daily goal and streak.";

    Alert.alert("End conversation?", body, [
      {
        text: "Just leave",
        style: "cancel",
        onPress: () => {
          router.push(`/(tabs)/${target}`);
        },
      },
      {
        text: "End & see feedback",
        style: "default",
        onPress: () => {
          // Same store-clear as confirmAndEnd — see comment there.
          clearActive();
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
    clearActive,
  ]);

  if (state.phase === "loading-session") {
    return (
      <Screen variant="gradient">
        <View style={activeStyles.center}>
          <ActivityIndicator size="large" color={palette.accent} />
          <EditorialText
            kind="bodyMd"
            color={palette.inkSoft}
            style={{ marginTop: spacing.base }}
          >
            Starting conversation…
          </EditorialText>
        </View>
      </Screen>
    );
  }

  if (state.phase === "error") {
    return (
      <Screen variant="gradient">
        <View style={activeStyles.center}>
          <EditorialText
            kind="bodyMd"
            color={palette.danger}
            align="center"
            style={{ marginBottom: spacing.base }}
          >
            {state.message}
          </EditorialText>
          <Pressable onPress={dismissError} style={activeStyles.ctaButton}>
            <EditorialText kind="bodyMd" color={palette.peach}>
              Try again
            </EditorialText>
          </Pressable>
          <Pressable
            onPress={() => router.replace("/(tabs)/practice")}
            style={[activeStyles.ctaButton, activeStyles.ctaButtonSecondary]}
          >
            <EditorialText kind="bodyMd" color={palette.inkSoft}>
              Back to start
            </EditorialText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen variant="gradient" edgeToEdge>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            listeningMode={listeningMode}
            revealed={revealedIds.has(item.id)}
            onReveal={revealMessage}
            languageCode={targetLang}
          />
        )}
        onContentSizeChange={centerLatest}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          // The target row isn't measured yet — jump to an estimate, then
          // re-center once layout settles.
          flatListRef.current?.scrollToOffset({
            offset: averageItemLength * index,
            animated: false,
          });
          setTimeout(centerLatest, 50);
        }}
        onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
        contentContainerStyle={[
          activeStyles.chatContainer,
          {
            paddingTop: insets.top + 64,
            // Half a viewport of empty space below the last message gives the
            // list room to lift the newest bubble all the way up to the vertical
            // center (viewPosition 0.5). Floor at the mic-bar clearance so the
            // bottom of a short conversation never tucks under the mic bar.
            paddingBottom: Math.max(micBarBottom + 96, listHeight * 0.5),
          },
        ]}
        ListEmptyComponent={
          <View style={activeStyles.emptyState}>
            <EditorialText
              kind="displayMd"
              italic
              align="center"
              color={palette.inkSoft}
            >
              {scenarioId ? "Setting the scene…" : "Tap the mic to say hello."}
            </EditorialText>
            <EditorialText
              kind="bodySm"
              align="center"
              color={palette.inkSoft}
              style={{ marginTop: spacing.md, opacity: 0.7 }}
            >
              {scenarioId
                ? "Your partner speaks first — then it's your turn."
                : "Your coach is listening — just talk like you would to a friend."}
            </EditorialText>
          </View>
        }
      />

      <TopStatusBar
        todaySeconds={todaySeconds}
        goalMinutes={goalMinutes}
        streakDays={streak ?? 0}
        listeningMode={listeningMode}
        onToggleListening={toggleListeningMode}
        shareLanguageCode={targetLang}
        shareStartedAt={startedAt}
        shareDurationMinutes={Math.floor(
          (Date.now() - startedAt.getTime()) / 60000,
        )}
        shareMessages={messages.map((m) => ({ role: m.role, text: m.text }))}
      />

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
        <MicButton
          onPress={onMicPress}
          isRecording={isRecording}
          isBusy={isBusy}
        />
      </View>

      <GoalReward
        visible={rewardTriggered}
        streakDays={(streak ?? 0) + 1}
        onHidden={dismissReward}
      />
    </Screen>
  );
}

// ============================================================
// Styles
// ============================================================

const chooserStyles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  title: {
    color: palette.ink,
  },
  subtitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  card: {
    // Solid cream instead of translucent palette.glassStrong. On Android,
    // translucent backgroundColor + elevation:2 makes the compositor draw a
    // visible opaque inner rectangle inside the shadow — the "grey rectangle
    // inside the rounded one" Bruno flagged. Cream is opaque and visually
    // matches the previous look on the sunrise gradient.
    backgroundColor: palette.cream,
    borderRadius: radius.lg,
    padding: spacing.base,
    marginBottom: spacing.md,
    gap: spacing.xs,
    ...shadow.card,
  },
  cardTitle: {
    color: palette.ink,
    fontWeight: "600",
  },
  historyHeader: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.glass,
    borderRadius: radius.md,
    padding: spacing.base,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  historyTitle: {
    color: palette.ink,
  },
});

const activeStyles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  chatContainer: {
    paddingHorizontal: spacing.base,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: spacing["3xl"] * 2,
    paddingHorizontal: spacing.xl,
  },
  micBar: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  processingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  ctaButton: {
    marginTop: spacing.base,
    backgroundColor: palette.ink,
    borderRadius: radius.lg,
    padding: spacing.md,
    paddingHorizontal: spacing.xl,
    ...shadow.cta,
  },
  ctaButtonSecondary: {
    backgroundColor: palette.cream,
    marginTop: spacing.sm,
    ...shadow.card,
  },
});
