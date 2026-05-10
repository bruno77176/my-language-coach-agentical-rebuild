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
      const { data, error } = await supabase
        .from("profiles")
        .update(update)
        .eq("user_id", userId)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error(
          "Update affected 0 rows — likely an RLS policy issue. Check Supabase profiles_update_own policy.",
        );
      }

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
