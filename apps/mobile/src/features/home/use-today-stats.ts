import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { useProfile } from "@/src/features/auth/use-profile";

export type TodayStats = {
  secondsSpoken: number;
  goalReached: boolean;
};

function todayInTimezone(timezone: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // YYYY-MM-DD
}

export function useTodayStats() {
  const { data: profile } = useProfile();
  const timezone = profile?.timezone ?? "UTC";
  const date = todayInTimezone(timezone);

  return useQuery<TodayStats>({
    queryKey: ["today-stats", profile?.user_id, date],
    enabled: !!profile,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("streak_days")
        .select("seconds_spoken, goal_reached")
        .eq("date", date)
        .maybeSingle();

      if (error) throw error;
      return {
        secondsSpoken: data?.seconds_spoken ?? 0,
        goalReached: data?.goal_reached ?? false,
      };
    },
  });
}
