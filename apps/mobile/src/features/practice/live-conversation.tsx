import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  EditorialText,
  GlassCard,
  Screen,
  TAB_BAR_RESERVE,
} from "@/src/design";
import { palette, radius, spacing } from "@language-coach/design-tokens";
import { useProfile } from "@/src/features/auth/use-profile";
import { useLiveConversation } from "./use-live-conversation";

const PHASE_LABEL: Record<string, string> = {
  idle: "Tap Start to begin",
  listening: "Listening…",
  thinking: "Thinking…",
  coachSpeaking: "Coach is speaking…",
};

// Live (always-listening) conversation UI. Rendered by the Practice screen only
// when the user has selected Live mode (gated server-side). The push-to-talk
// ActiveConversation is a separate component and is untouched.
export function LiveConversation({ scenarioId }: { scenarioId?: string }) {
  const insets = useSafeAreaInsets();
  const { data: profile } = useProfile();
  const targetLang = profile?.target_lang ?? "en";
  const { state, start, stop, toggleMute } = useLiveConversation(
    targetLang,
    scenarioId,
  );

  // Stop the mic + socket when leaving the screen.
  useEffect(
    () => () => {
      void stop();
    },
    [stop],
  );

  const running = state.phase !== "idle";

  return (
    <Screen variant="gradient">
      <View
        style={[
          styles.container,
          {
            paddingTop: insets.top + spacing.lg,
            paddingBottom: insets.bottom + TAB_BAR_RESERVE + spacing.lg,
          },
        ]}
      >
        <EditorialText kind="displayMd" italic style={styles.title}>
          Live conversation
        </EditorialText>
        <EditorialText
          kind="bodySm"
          color={palette.inkSoft}
          style={styles.hint}
        >
          Always-listening — just talk. 🎧 Headphones recommended.
        </EditorialText>

        <GlassCard style={styles.statusCard}>
          <EditorialText kind="bodyMd" style={styles.status}>
            {state.error
              ? `⚠️ ${state.error}`
              : (PHASE_LABEL[state.phase] ?? state.phase)}
          </EditorialText>
        </GlassCard>

        <View style={styles.transcript}>
          {!!state.userTranscript && (
            <EditorialText
              kind="bodyMd"
              color={palette.inkSoft}
              style={styles.you}
            >
              You: {state.userTranscript}
            </EditorialText>
          )}
          {!!state.coachText && (
            <EditorialText kind="bodyMd" style={styles.coach}>
              {state.coachText}
            </EditorialText>
          )}
        </View>

        <View style={styles.controls}>
          {!running ? (
            <Pressable
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => void start()}
            >
              <EditorialText kind="bodyMd" style={styles.btnText}>
                Start
              </EditorialText>
            </Pressable>
          ) : (
            <>
              <Pressable
                style={[
                  styles.btn,
                  state.muted ? styles.btnMuted : styles.btnSecondary,
                ]}
                onPress={toggleMute}
              >
                <EditorialText kind="bodyMd" style={styles.btnText}>
                  {state.muted ? "Muted 🔇" : "Mute 🎙️"}
                </EditorialText>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnStop]}
                onPress={() => void stop()}
              >
                <EditorialText kind="bodyMd" style={styles.btnText}>
                  End
                </EditorialText>
              </Pressable>
            </>
          )}
        </View>

        <Pressable
          onPress={() => {
            void stop();
            router.replace("/(tabs)/practice");
          }}
          style={styles.leave}
        >
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            ← Leave
          </EditorialText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: spacing.lg },
  title: { marginBottom: spacing.xs },
  hint: { marginBottom: spacing.lg },
  statusCard: { padding: spacing.md, alignItems: "center" },
  status: { textAlign: "center" },
  transcript: { flex: 1, marginTop: spacing.lg, gap: spacing.md },
  you: {},
  coach: {},
  controls: {
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  btn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.lg,
    alignItems: "center",
    minWidth: 120,
  },
  btnPrimary: { backgroundColor: palette.accent },
  btnSecondary: { backgroundColor: "rgba(0,0,0,0.08)" },
  btnMuted: { backgroundColor: "rgba(220,80,80,0.18)" },
  btnStop: { backgroundColor: "rgba(220,80,80,0.18)" },
  btnText: { textAlign: "center" },
  leave: { alignItems: "center", marginTop: spacing.lg },
});
