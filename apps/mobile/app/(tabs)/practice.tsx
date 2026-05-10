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
import { useProfile } from "@/src/features/auth/use-profile";
import { useAudioSessionInit } from "@/src/lib/audio-session";
import { useConversation } from "@/src/features/practice/use-conversation";
import type { ChatMessage } from "@/src/features/practice/types";
import { MessageBubble } from "@/src/features/practice/MessageBubble";
import { MicButton } from "@/src/features/practice/MicButton";
import { ShareButton } from "@/src/features/practice/share-button";

export default function PracticeScreen() {
  useAudioSessionInit();
  const { data: profile } = useProfile();
  const targetLang = profile?.target_lang ?? "en";

  const [startedAt] = useState<Date>(() => new Date());

  const { state, messages, start, stop, end } = useConversation(targetLang);
  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  // Auto-scroll on new message
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
    if (state.phase === "idle") {
      void start();
      return;
    }
    if (state.phase === "recording") {
      void stop();
    }
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
        <Pressable
          onPress={() => router.replace("/(tabs)/home")}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Back to Home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <ShareButton
          languageCode={targetLang}
          startedAt={startedAt}
          durationMinutes={Math.floor(
            (Date.now() - startedAt.getTime()) / 60000,
          )}
          messages={messages.map((m) => ({ role: m.role, text: m.text }))}
        />
        <Pressable onPress={onExit} style={styles.exitButton}>
          <Text style={styles.exitText}>End</Text>
        </Pressable>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
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
  topBar: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  exitButton: { paddingHorizontal: 12, paddingVertical: 6 },
  exitText: { color: "#2563eb", fontWeight: "600" },
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
});
