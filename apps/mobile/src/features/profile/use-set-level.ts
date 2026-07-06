import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";

// Set the user's self-declared CEFR level for a target language. Calls the
// set_my_level RPC, which updates the per-language declared map AND re-seeds the
// AI-inferred coach_memory level so the choice takes effect on the next turn.
// An empty level ("I'm not sure") clears the declaration server-side.
export function useSetLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ lang, level }: { lang: string; level: string }) => {
      const { error } = await supabase.rpc("set_my_level", {
        p_lang: lang,
        p_level: level || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
