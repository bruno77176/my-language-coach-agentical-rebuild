import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useCallback } from "react";
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
import { stopActivePlayer } from "@/src/features/practice/audio-controller";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProfile } from "@/src/features/auth/use-profile";
import { useAudioSessionInit } from "@/src/lib/audio-session";
import { useConversation } from "@/src/features/practice/use-conversation";
import type { ChatMessage } from "@/src/features/practice/types";
import { MessageBubble } from "@/src/features/practice/MessageBubble";
import { MicButton } from "@/src/features/practice/MicButton";
import { TopStatusBar } from "@/src/features/practice/top-status-bar";
import { useSessionTimer } from "@/src/features/practice/use-session-timer";
import { useGoalReward } from "@/src/features/practice/use-goal-reward";
import { GoalReward } from "@/src/features/practice/goal-reward";
import { useTodayStats } from "@/src/features/home/use-today-stats";
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

export default function PracticeScreen() {
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
  } = useConversation(targetLang, displayName, nativeLang);

  const { data: todayStats } = useTodayStats();
  const { data: streak } = useCurrentStreak();
  const queryClient = useQueryClient();

  // Pause timer + stop audio when the user leaves the Practice tab.
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
    Alert.alert("End conversation?", undefined, [
      { text: "Keep talking", style: "cancel" },
      {
        text: "End",
        style: "destructive",
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
            // Reset local session counters BEFORE invalidating queries.
            // Otherwise the refetched todayStats (which now includes the
            // session we just ended) gets added on top of sessionSeconds in
            // todaySecondsAtStartRef, double-counting today's seconds and
            // mis-triggering the goal-reward.
            resetSessionTimer();
            todaySecondsAtStartRef.current = 0;
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["today-stats"] }),
              queryClient.invalidateQueries({ queryKey: ["progress-summary"] }),
              queryClient.invalidateQueries({ queryKey: ["current-streak"] }),
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
              router.replace("/(tabs)/home");
            }
          })();
        },
      },
    ]);
  };

  if (state.phase === "loading-session") {
    return (
      <Screen variant="gradient">
        <View style={styles.center}>
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
        <View style={styles.center}>
          <EditorialText
            kind="bodyMd"
            color={palette.danger}
            align="center"
            style={{ marginBottom: spacing.base }}
          >
            {state.message}
          </EditorialText>
          <Pressable onPress={dismissError} style={styles.ctaButton}>
            <EditorialText kind="bodyMd" color={palette.peach}>
              Try again
            </EditorialText>
          </Pressable>
          <Pressable
            onPress={() => router.replace("/(tabs)/home")}
            style={[styles.ctaButton, styles.ctaButtonSecondary]}
          >
            <EditorialText kind="bodyMd" color={palette.inkSoft}>
              Back to Home
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
          styles.chatContainer,
          {
            paddingTop: insets.top + 64,
            paddingBottom: micBarBottom + 96,
          },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <EditorialText
              kind="displayMd"
              italic
              align="center"
              color={palette.inkSoft}
            >
              Tap the mic to say hello.
            </EditorialText>
            <EditorialText
              kind="bodySm"
              align="center"
              color={palette.inkSoft}
              style={{ marginTop: spacing.md, opacity: 0.7 }}
            >
              Your coach is listening — just talk like you would to a friend.
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

      <View style={[styles.micBar, { bottom: micBarBottom }]}>
        {state.phase === "processing" && (
          <GlassCard
            radiusToken="pill"
            padding="sm"
            style={styles.processingPill}
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

const styles = StyleSheet.create({
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
