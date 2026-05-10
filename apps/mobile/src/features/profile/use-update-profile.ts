import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";

export type ProfileUpdate = Partial<{
  display_name: string;
  native_lang: string;
  target_lang: string;
  daily_goal_minutes: number;
}>;

export function useUpdateProfile(userId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (update: ProfileUpdate) => {
      const { error } = await supabase
        .from("profiles")
        .update(update)
        .eq("user_id", userId);
      if (error) throw error;

      if (update.native_lang) {
        const { error: rpcErr } = await supabase.rpc("clear_my_translations");
        if (rpcErr) throw rpcErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["today-stats"] });
      qc.invalidateQueries({ queryKey: ["progress-summary"] });
    },
  });
}
