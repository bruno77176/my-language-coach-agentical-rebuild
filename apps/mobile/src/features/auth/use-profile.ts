import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/src/lib/supabase";
import { useAuthStore } from "./auth-store";

export function useProfile() {
  const session = useAuthStore((s) => s.session);
  const userId = session?.user.id;
  const email = session?.user.email;
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      // Merge the authenticated user's email (from the JWT session) into the
      // profile object so the profile screen can display it without an extra
      // Supabase auth.getUser() call.
      return data ? { ...data, email: email ?? null } : data;
    },
  });
}
