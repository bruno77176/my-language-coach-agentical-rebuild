import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
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
  const { data: profile } = useProfile();
  const targetLang = profile?.target_lang ?? "en";
  const displayName = profile?.display_name ?? "there";
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
  } = useConversation(targetLang, displayName);

  const { data: todayStats } = useTodayStats();
  const { data: streak } = useCurrentStreak();
  const queryClient = useQueryClient();

  const sessionActive =
    state.phase === "idle" ||
    state.phase === "recording" ||
    state.phase === "processing";
  const { seconds: sessionSeconds } = useSessionTimer(sessionActive);

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
            try {
              await end();
            } catch {
              /* best-effort */
            }
            // Refresh home / progress queries so the just-ended session's
            // minutes show up immediately when navigating away.
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["today-stats"] }),
              queryClient.invalidateQueries({ queryKey: ["progress-summary"] }),
              queryClient.invalidateQueries({ queryKey: ["current-streak"] }),
            ]);
            router.replace("/(tabs)/home");
          })();
        },
      },
    ]);
  };

  if (state.phase === "loading-session") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Starting conversation…</Text>
      </View>
    );
  }
  if (state.phase === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{state.message}</Text>
        <Pressable onPress={dismissError} style={styles.button}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace("/(tabs)/home")}
          style={[styles.button, styles.buttonSecondary]}
        >
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
            Back to Home
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
        contentContainerStyle={styles.chatContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              Tap the mic to start talking with your coach.
            </Text>
          </View>
        }
      />

      <View style={styles.micBar}>
        {state.phase === "processing" && (
          <View style={styles.processingPill}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.processingText}>Coach is thinking…</Text>
          </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    padding: 24,
  },
  loadingText: { marginTop: 16, color: "#6b7280" },
  errorText: { color: "#b91c1c", textAlign: "center", marginBottom: 16 },
  chatContainer: { padding: 16, paddingBottom: 120 },
  emptyState: { alignItems: "center", paddingTop: 80, paddingHorizontal: 24 },
  emptyText: { color: "#6b7280", textAlign: "center", fontSize: 14 },
  micBar: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  processingPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  processingText: { color: "#374151", marginLeft: 8, fontSize: 13 },
  button: {
    marginTop: 16,
    backgroundColor: "#2563eb",
    borderRadius: 8,
    padding: 14,
    paddingHorizontal: 24,
  },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  buttonSecondary: { backgroundColor: "#e5e7eb", marginTop: 8 },
  buttonTextSecondary: { color: "#374151" },
});
