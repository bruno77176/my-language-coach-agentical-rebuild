import { ScrollView, StyleSheet, View, Pressable } from "react-native";
import { router, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { EditorialText, Screen } from "@/src/design";
import { palette, radius, spacing } from "@language-coach/design-tokens";
import {
  API_BASE_URL,
  authHeader,
  clientPlatformHeader,
} from "@/src/lib/api-client";
import { usePurchases } from "@/src/features/paywall/use-purchases";

type Summary = {
  session_count: number;
  total_seconds: number;
  languages_practiced: number;
};

async function fetchSummary(): Promise<Summary> {
  const res = await fetch(`${API_BASE_URL}/v1/progress/weekly-summary`, {
    headers: {
      authorization: await authHeader(),
      ...clientPlatformHeader(),
    },
  });
  if (!res.ok) {
    throw new Error(`fetchSummary ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<Summary>;
}

export default function WeeklySummary() {
  const { isPro } = usePurchases();
  const { data } = useQuery<Summary>({
    queryKey: ["weekly-summary"],
    queryFn: fetchSummary,
  });

  return (
    <Screen variant="gradient">
      <Stack.Screen options={{ title: "Weekly summary" }} />
      <ScrollView contentContainerStyle={styles.container}>
        <EditorialText kind="displayMd" italic style={styles.title}>
          Your week
        </EditorialText>
        {data ? (
          <View style={styles.statsRow}>
            <Stat label="Sessions" value={data.session_count} />
            <Stat label="Minutes" value={Math.floor(data.total_seconds / 60)} />
            <Stat label="Languages" value={data.languages_practiced} />
          </View>
        ) : (
          <EditorialText kind="bodyMd" color={palette.inkSoft}>
            Loading…
          </EditorialText>
        )}
        {!isPro && (
          <Pressable
            onPress={() => router.push("/(modals)/paywall")}
            style={styles.upgrade}
          >
            <EditorialText kind="bodyMd" color={palette.peach}>
              Unlock full feedback history with Pro
            </EditorialText>
          </Pressable>
        )}
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <EditorialText kind="displayMd" style={styles.statValue}>
        {value}
      </EditorialText>
      <EditorialText kind="bodySm" color={palette.inkSoft}>
        {label}
      </EditorialText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.xl, gap: spacing.xl },
  title: { color: palette.ink },
  statsRow: {
    flexDirection: "row",
    gap: spacing.lg,
    justifyContent: "space-around",
  },
  stat: { alignItems: "center" },
  statValue: { color: palette.ink },
  upgrade: {
    backgroundColor: palette.ink,
    borderRadius: radius.lg,
    padding: spacing.base,
    alignItems: "center",
    marginTop: spacing.lg,
  },
});
