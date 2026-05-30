import { useState } from "react";
import { StyleSheet, View, Pressable, Alert } from "react-native";
import { router } from "expo-router";
import { EditorialText, Screen } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";
import { usePurchases } from "@/src/features/paywall/use-purchases";

const FEATURES_LIST = [
  "Memory that remembers you across sessions",
  "Full feedback history for every conversation",
  "All 10 role-play scenarios",
  "60 min/day soft cap (vs 10 min on free)",
];

export default function PaywallModal() {
  const { offerings, purchase, restore } = usePurchases();
  const [busy, setBusy] = useState<"monthly" | "annual" | null>(null);

  const onPurchase = async (kind: "monthly" | "annual") => {
    setBusy(kind);
    try {
      await purchase(kind);
      Alert.alert("Welcome to Pro!", "Your features are unlocked.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      const msg = String(e);
      if (!msg.includes("cancelled") && !msg.includes("Cancel")) {
        Alert.alert("Purchase failed", msg);
      }
    } finally {
      setBusy(null);
    }
  };

  const onRestore = async () => {
    try {
      await restore();
      Alert.alert("Restored", "Your purchases have been restored.");
    } catch (e) {
      Alert.alert("Couldn't restore", String(e));
    }
  };

  const monthly = offerings?.monthly?.product;
  const annual = offerings?.annual?.product;

  return (
    <Screen variant="gradient">
      <View style={styles.container}>
        <EditorialText kind="displayMd" italic style={styles.title}>
          Unlock your coach
        </EditorialText>
        <View style={styles.bullets}>
          {FEATURES_LIST.map((f) => (
            <EditorialText
              key={f}
              kind="bodyMd"
              color={palette.ink}
              style={styles.bullet}
            >
              • {f}
            </EditorialText>
          ))}
        </View>
        <Pressable
          onPress={() => onPurchase("annual")}
          style={[styles.btnAnnual, busy === "annual" && styles.busy]}
          disabled={!!busy}
        >
          <EditorialText kind="bodyMd" color={palette.peach}>
            Annual {annual ? `— ${annual.priceString}/yr` : ""} · save 48%
          </EditorialText>
        </Pressable>
        <Pressable
          onPress={() => onPurchase("monthly")}
          style={[styles.btnMonthly, busy === "monthly" && styles.busy]}
          disabled={!!busy}
        >
          <EditorialText kind="bodyMd" color={palette.ink}>
            Monthly {monthly ? `— ${monthly.priceString}/mo` : ""}
          </EditorialText>
        </Pressable>
        <EditorialText
          kind="bodySm"
          color={palette.inkSoft}
          style={styles.fineprint}
        >
          7-day free trial. Cancel anytime in Google Play settings.
        </EditorialText>
        <Pressable onPress={onRestore} style={styles.restore}>
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            Restore purchases
          </EditorialText>
        </Pressable>
        <Pressable onPress={() => router.back()} style={styles.close}>
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            Maybe later
          </EditorialText>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, justifyContent: "center" },
  title: { color: palette.ink, marginBottom: spacing.xl },
  bullets: { gap: spacing.sm, marginBottom: spacing.xl },
  bullet: {},
  btnAnnual: {
    backgroundColor: palette.ink,
    borderRadius: radius.lg,
    padding: spacing.base,
    alignItems: "center",
    marginBottom: spacing.md,
    ...shadow.cta,
  },
  btnMonthly: {
    backgroundColor: palette.glassStrong,
    borderRadius: radius.lg,
    padding: spacing.base,
    alignItems: "center",
  },
  busy: { opacity: 0.6 },
  fineprint: { textAlign: "center", marginTop: spacing.md },
  restore: { marginTop: spacing.md, alignItems: "center" },
  close: { marginTop: spacing.sm, alignItems: "center" },
});
