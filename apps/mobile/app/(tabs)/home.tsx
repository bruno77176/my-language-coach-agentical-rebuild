import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { quoteForDay, type SupportedLang } from "@language-coach/shared";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";
import { EditorialText, Screen } from "@/src/design";
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
      <Screen variant="gradient">
        <View style={styles.loading}>
          <ActivityIndicator color={palette.ink} />
        </View>
      </Screen>
    );
  }

  const quote = quoteForDay(new Date(), profile.timezone);

  return (
    <Screen variant="gradient">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.row}>
          <EditorialText kind="caps" color={palette.inkSoft}>
            {dateLabel(profile.timezone)}
          </EditorialText>
          <View style={styles.streakPill}>
            <EditorialText kind="bodySm" color={palette.peach}>
              {"🔥"} {streak ?? 0}
            </EditorialText>
          </View>
        </View>

        <EditorialText kind="displayXl" style={styles.greeting}>
          Hi {profile.display_name}.
        </EditorialText>

        <QuoteCard
          quote={quote}
          nativeLang={profile.native_lang as SupportedLang}
        />

        <TodayProgress
          secondsSpoken={stats?.secondsSpoken ?? 0}
          dailyGoalMinutes={profile.daily_goal_minutes}
        />

        <Pressable
          style={styles.cta}
          onPress={() => router.push("/(tabs)/practice")}
          hitSlop={8}
        >
          <EditorialText
            kind="bodyLg"
            color={palette.peach}
            style={styles.ctaText}
          >
            {"▸"} Start practising
          </EditorialText>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  container: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: 120, // reserves TAB_BAR_RESERVE + spacing.xl clearance for floating tab bar
    gap: spacing.lg,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  streakPill: {
    backgroundColor: palette.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    minHeight: 28,
    justifyContent: "center",
  },
  greeting: { marginTop: spacing.sm },
  cta: {
    backgroundColor: palette.ink,
    paddingVertical: spacing.base + 2,
    borderRadius: radius.lg,
    alignItems: "center",
    minHeight: 52,
    ...shadow.cta,
  },
  ctaText: { fontWeight: "600" },
});
