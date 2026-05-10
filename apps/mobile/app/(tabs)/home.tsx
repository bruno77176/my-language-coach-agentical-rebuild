import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { quoteForDay, type SupportedLang } from "@language-coach/shared";
import { useProfile } from "@/src/features/auth/use-profile";
import { useTodayStats } from "@/src/features/home/use-today-stats";
import { QuoteCard } from "@/src/features/home/quote-card";
import { TodayProgress } from "@/src/features/home/today-progress";
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

function dateLabel(timezone: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: timezone,
  }).format(new Date());
}

export default function HomeScreen() {
  const router = useRouter();
  const { data: profile, isLoading: loadingProfile } = useProfile();
  const { data: stats } = useTodayStats();
  const { data: streak } = useCurrentStreak();

  if (loadingProfile || !profile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  const quote = quoteForDay(new Date(), profile.timezone);
  const streakLabel =
    (streak ?? 0) > 0
      ? `🔥 ${streak}-day streak`
      : "Build your first streak today";

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.greeting}>Hi {profile.display_name} 👋</Text>
      <Text style={styles.date}>{dateLabel(profile.timezone)}</Text>

      <View style={styles.spacerLg} />

      <QuoteCard
        quote={quote}
        nativeLang={profile.native_lang as SupportedLang}
      />

      <View style={styles.spacerLg} />

      <TodayProgress
        secondsSpoken={stats?.secondsSpoken ?? 0}
        dailyGoalMinutes={profile.daily_goal_minutes}
      />

      <Pressable
        style={styles.cta}
        onPress={() => router.push("/(tabs)/practice")}
      >
        <Text style={styles.ctaText}>▶ Start practicing</Text>
      </Pressable>

      <Text style={styles.streak}>{streakLabel}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: {
    padding: 24,
    paddingTop: 48,
    backgroundColor: "#ffffff",
    alignItems: "center",
  },
  greeting: { fontSize: 24, fontWeight: "700", color: "#111827" },
  date: { fontSize: 14, color: "#6b7280", marginTop: 4 },
  spacerLg: { height: 24 },
  cta: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: "100%",
    alignItems: "center",
    marginTop: 8,
  },
  ctaText: { color: "#ffffff", fontSize: 18, fontWeight: "700" },
  streak: { fontSize: 14, color: "#374151", marginTop: 24 },
});
