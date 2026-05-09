import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { useOnboardingStore } from "./onboarding-store";

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  const reset = useOnboardingStore((s) => s.reset);

  return useMutation({
    mutationFn: async () => {
      const { displayName, nativeLang, targetLang, dailyGoalMinutes } =
        useOnboardingStore.getState();
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const { data, error } = await supabase.rpc("complete_onboarding", {
        p_display_name: displayName,
        p_native_lang: nativeLang,
        p_target_lang: targetLang,
        p_daily_goal_minutes: dailyGoalMinutes,
        p_timezone: timezone,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      // Await the refetch so the index gate sees the new profile when we navigate.
      // Without this, navigation can race ahead of the cache update and the gate
      // bounces back to onboarding.
      await queryClient.refetchQueries({ queryKey: ["profile"] });
      reset();
    },
  });
}
