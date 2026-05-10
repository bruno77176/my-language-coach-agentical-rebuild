import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";

export type ProgressDay = {
  date: string; // YYYY-MM-DD
  seconds_spoken: number;
  goal_reached: boolean;
};

export type ProgressSummary = {
  current_streak: number;
  longest_streak: number;
  total_minutes: number;
  week_minutes: number;
  total_sessions: number;
  days: ProgressDay[];
};

export function useProgressSummary() {
  return useQuery<ProgressSummary>({
    queryKey: ["progress-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_progress_summary");
      if (error) throw error;
      return data as ProgressSummary;
    },
  });
}
