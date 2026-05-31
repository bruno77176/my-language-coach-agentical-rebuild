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
import { stopActivePlayer } from "@/src/features/practice/audio-controller";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/src/features/auth/use-profile";
import { useAudioSessionInit } from "@/src/lib/audio-session";
import { useConversation } from "@/src/features/practice/use-conversation";
import type { ChatMessage } from "@/src/features/practice/types";
import { MessageBubble } from "@/src/features/practice/MessageBubble";
import { MicButton } from "@/src/features/practice/MicButton";
import { TopStatusBar } from "@/src/features/practice/top-status-bar";
import { EndButtonCoachmark } from "@/src/features/practice/end-button-coachmark";
import { useSessionTimer } from "@/src/features/practice/use-session-timer";
import { useGoalReward } from "@/src/features/practice/use-goal-reward";
import { GoalReward } from "@/src/features/practice/goal-reward";
import { useTodayStats } from "@/src/features/home/use-today-stats";
import {
  useRecentSessions,
  type RecentSession,
} from "@/src/features/practice/use-recent-sessions";
import { supabase } from "@/src/lib/supabase";

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
  const { scenarioId, start } = useLocalSearchParams<{
    scenarioId?: string;
    start?: string;
  }>();
  const isActive = !!scenarioId || start === "free";

  if (!isActive) {
    return <PracticeChooser />;
  }
  // key forces a fresh ActiveConversation (and thus a fresh useConversation
  // session) when scenarioId changes — picking a new scenario mid-day
  // should not reuse a stale conversation_id.
  const k = scenarioId ?? "free";
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

  const [startedAt] = useState<Date>(() => new Date());

  const {
    state,
    messages,
    listeningMode,
    revealedIds,
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
      return () => {
        setIsFocused(false);
        stopActivePlayer();
      };
    }, []),
  );

  const sessionActive =
    isFocused &&
    (state.phase === "idle" ||
      state.phase === "recording" ||
      state.phase === "processing");
  const { seconds: sessionSeconds, reset: resetSessionTimer } =
    useSessionTimer(sessionActive);

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
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [messages.length]);

  const isBusy =
    state.phase === "processing" || state.phase === "loading-session";
  const isRecording = state.phase === "recording";

  const onMicPress = () => {
    if (state.phase === "idle") void start();
    else if (state.phase === "recording") void stop();
  };

  const onExit = () => {
    Alert.alert(
      "End conversation?",
      "Your coach will prepare a feedback report — your highlights, things to polish, and new vocabulary worth remembering. Your practice time also goes toward your daily goal and streak.",
      [
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
                queryClient.invalidateQueries({
                  queryKey: ["progress-summary"],
                }),
                queryClient.invalidateQueries({ queryKey: ["current-streak"] }),
                queryClient.invalidateQueries({
                  queryKey: ["recent-sessions"],
                }),
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
      ],
    );
  };

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
          />
        )}
        contentContainerStyle={[
          activeStyles.chatContainer,
          {
            paddingTop: insets.top + 64,
            paddingBottom: micBarBottom + 96,
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
              {scenarioId
                ? "Tap the mic to begin."
                : "Tap the mic to say hello."}
            </EditorialText>
            <EditorialText
              kind="bodySm"
              align="center"
              color={palette.inkSoft}
              style={{ marginTop: spacing.md, opacity: 0.7 }}
            >
              {scenarioId
                ? "You make the first move — walk in and speak. The other person will respond in their role."
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
        onExit={onExit}
      />

      <EndButtonCoachmark />

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
    backgroundColor: palette.glassStrong,
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
    backgroundColor: palette.glassStrong,
    marginTop: spacing.sm,
    ...shadow.card,
  },
});
