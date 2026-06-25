import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EditorialText, Screen } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";
import { usePurchases } from "@/src/features/paywall/use-purchases";
import { adExtension } from "@/src/lib/api-client";
import { showRewardedAd } from "@/src/lib/rewarded-ad";
import {
  useDailyCap,
  AD_EXTENSION_SECONDS,
} from "@/src/features/practice/daily-cap-store";

/** Live "Resets at midnight · in 3h 12m" string, or null when unknown. */
function useResetCountdown(resetAt?: string): string | null {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!resetAt) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [resetAt]);

  if (!resetAt) return null;
  const ms = Date.parse(resetAt) - Date.now();
  if (!Number.isFinite(ms)) return null;
  if (ms <= 0) return "Resets now — pull to refresh";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const rel = h > 0 ? `${h}h ${m}m` : `${m}m`;
  return `Resets at midnight · in ${rel}`;
}

export default function DailyLimitModal() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ resetAt?: string; mode?: string }>();
  const resetAt = Array.isArray(params.resetAt)
    ? params.resetAt[0]
    : params.resetAt;
  const mode = (Array.isArray(params.mode) ? params.mode[0] : params.mode) as
    | "resume"
    | "restart"
    | undefined;
  const countdown = useResetCountdown(resetAt);

  const { isPro } = usePurchases();
  // Only auto-dismiss if Pro is unlocked *while on this screen* — a Pro user who
  // hits their own 60-min cap arrives already-Pro and should stay to read it.
  const wasProOnMount = useRef(isPro);
  // Drive the message + CTAs off the SERVER's cap (authoritative), NOT the
  // RevenueCat client flag — in testing they can disagree (Test Store has no
  // webhook), which wrongly showed a free user the "60 minutes" Pro message.
  const capSeconds = useDailyCap((s) => s.capSeconds);
  const capMinutes = capSeconds != null ? Math.round(capSeconds / 60) : 10;
  const isPaidCap = capSeconds != null && capSeconds > 600;
  const [adBusy, setAdBusy] = useState(false);
  const [adUsedUp, setAdUsedUp] = useState(false);

  // Return the user to where they came from once the limit is lifted (upgrade
  // or ad). "resume": the conversation is still mounted underneath → just pop.
  // "restart": they were blocked at session-start → re-enter Practice fresh.
  const onUnlocked = useCallback(() => {
    if (mode === "restart") {
      router.replace("/(tabs)/practice");
    } else {
      router.back();
    }
  }, [mode]);

  useEffect(() => {
    if (isPro && !wasProOnMount.current) onUnlocked();
  }, [isPro, onUnlocked]);

  const onWatchAd = async () => {
    setAdBusy(true);
    try {
      // Show a real rewarded ad first; only grant the +3 min if the user
      // actually earned the reward (watched it through). A failed load or an
      // early dismissal grants nothing.
      const earned = await showRewardedAd();
      if (!earned) {
        Alert.alert(
          "No reward",
          "The ad didn't finish, so no time was added. Please try again.",
        );
        return;
      }
      // Record the grant server-side (enforces the once-per-day cap). The
      // backend doesn't yet verify the ad server-side — that lands with
      // AdMob SSV later; the client gating above is the current guard.
      await adExtension();
      // Extend the live client budget too, so the session timer doesn't
      // immediately re-trigger the limit on resume.
      useDailyCap.getState().addBonus(AD_EXTENSION_SECONDS);
      onUnlocked();
    } catch (e) {
      const msg = String(e);
      if (msg.includes("409") || msg.includes("AD_LIMIT")) {
        setAdUsedUp(true);
      } else {
        Alert.alert("Couldn't add time", msg);
      }
    } finally {
      setAdBusy(false);
    }
  };

  const onClose = () => router.replace("/(tabs)/home");

  return (
    <Screen variant="gradient">
      <Pressable
        onPress={onClose}
        style={[styles.closeButton, { top: insets.top + spacing.md }]}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <Ionicons name="close" size={28} color={palette.ink} />
      </Pressable>

      <View style={styles.container}>
        <EditorialText kind="displayMd" italic style={styles.title}>
          Daily limit reached
        </EditorialText>

        <EditorialText kind="bodyLg" color={palette.ink} style={styles.body}>
          {isPaidCap
            ? `You've reached today's ${capMinutes} minutes of practice.`
            : `You've used your free ${capMinutes} minutes today.`}
        </EditorialText>

        {countdown ? (
          <EditorialText
            kind="bodyMd"
            color={palette.inkSoft}
            style={styles.countdown}
          >
            {countdown}
          </EditorialText>
        ) : (
          <EditorialText
            kind="bodyMd"
            color={palette.inkSoft}
            style={styles.countdown}
          >
            Resets at midnight.
          </EditorialText>
        )}

        {/* Free users get the chooser: watch an ad for +3 min, or go Pro. Pro
            users at their own cap just wait for the reset. */}
        {!isPaidCap && (
          <View style={styles.actions}>
            <Pressable
              onPress={() => router.push("/(modals)/paywall")}
              style={styles.btnPrimary}
            >
              <EditorialText kind="bodyMd" color={palette.peach}>
                Unlock everything — Go Pro
              </EditorialText>
            </Pressable>

            <Pressable
              onPress={onWatchAd}
              disabled={adBusy || adUsedUp}
              style={[styles.btnSecondary, (adBusy || adUsedUp) && styles.busy]}
            >
              {adBusy ? (
                <ActivityIndicator color={palette.ink} />
              ) : (
                <EditorialText kind="bodyMd" color={palette.ink}>
                  {adUsedUp
                    ? "No more ad time today"
                    : "Watch an ad for +3 min"}
                </EditorialText>
              )}
            </Pressable>
          </View>
        )}

        <Pressable onPress={onClose} style={styles.dismiss}>
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            {isPaidCap ? "Close" : "Not now"}
          </EditorialText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    position: "absolute",
    right: spacing.lg,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.glassStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  container: { flex: 1, padding: spacing.xl, justifyContent: "center" },
  title: { color: palette.ink, marginBottom: spacing.md },
  body: { marginBottom: spacing.sm },
  countdown: { marginBottom: spacing.xl },
  actions: { gap: spacing.md },
  btnPrimary: {
    backgroundColor: palette.ink,
    borderRadius: radius.lg,
    padding: spacing.base,
    alignItems: "center",
    ...shadow.cta,
  },
  btnSecondary: {
    backgroundColor: palette.glassStrong,
    borderRadius: radius.lg,
    padding: spacing.base,
    alignItems: "center",
  },
  busy: { opacity: 0.6 },
  dismiss: { marginTop: spacing.lg, alignItems: "center" },
});
