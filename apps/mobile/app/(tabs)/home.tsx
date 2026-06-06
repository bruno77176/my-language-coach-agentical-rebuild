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
import { useOfflineQuote } from "@/src/features/home/use-offline-quote";
import { useVocabDeck } from "@/src/features/vocab/use-vocab-deck";
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
  const cachedQuote = useOfflineQuote(profile ?? null);
  const { data: vocab } = useVocabDeck(profile?.target_lang);

  // Block on spinner if profile hasn't loaded AND there's no cached quote, OR
  // if we have no profile and no cached quote at all (e.g., anonymous user
  // landed here via a stray redirect — the auth gate will catch up shortly).
  if ((loadingProfile && !cachedQuote) || (!profile && !cachedQuote)) {
    return (
      <Screen variant="gradient">
        <View style={styles.loading}>
          <ActivityIndicator color={palette.ink} />
        </View>
      </Screen>
    );
  }

  // Use live quote when profile is available, otherwise fall back to cache.
  const quote = profile
    ? quoteForDay(new Date(), profile.timezone)
    : cachedQuote!;

  // Derive display values: use profile data when available, else sensible fallbacks.
  const displayName = profile?.display_name ?? "there";
  const timezone = profile?.timezone ?? "UTC";
  const dailyGoalMinutes = profile?.daily_goal_minutes ?? 10;
  const nativeLang = (profile?.native_lang ?? "en") as SupportedLang;

  return (
    <Screen variant="gradient">
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.row}>
          <EditorialText kind="caps" color={palette.inkSoft}>
            {dateLabel(timezone)}
          </EditorialText>
          <View style={styles.streakPill}>
            <EditorialText kind="bodySm" color={palette.peach}>
              {"🔥"} {streak ?? 0}
            </EditorialText>
          </View>
        </View>

        <EditorialText kind="displayXl" style={styles.greeting}>
          Hi {displayName}.
        </EditorialText>

        <QuoteCard quote={quote} nativeLang={nativeLang} />

        <TodayProgress
          secondsSpoken={stats?.secondsSpoken ?? 0}
          dailyGoalMinutes={dailyGoalMinutes}
        />

        {vocab && vocab.items.length > 0 ? (
          <Pressable
            style={styles.vocabCard}
            onPress={() => router.push("/vocab")}
            hitSlop={8}
          >
            <View style={{ flex: 1 }}>
              <EditorialText kind="bodyLg" color={palette.ink}>
                Review your words
              </EditorialText>
              <EditorialText kind="bodySm" color={palette.inkSoft}>
                {vocab.dueCount > 0
                  ? `${vocab.dueCount} to review`
                  : "All caught up — browse anytime"}
              </EditorialText>
            </View>
            <EditorialText kind="displayMd" color={palette.accent}>
              {vocab.items.length}
            </EditorialText>
          </Pressable>
        ) : null}

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
  vocabCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.glassStrong,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.cta,
  },
});
