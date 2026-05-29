import { useState } from "react";
import { useRouter } from "expo-router";
import { selfDeleteAccount } from "@/src/lib/api-client";
import { supabase } from "@/src/lib/supabase";
import { showToast } from "@/src/lib/toast";

export function useDeleteAccount() {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function run() {
    setDeleting(true);
    try {
      await selfDeleteAccount();
      await supabase.auth.signOut();
      router.replace("/(auth)/sign-in");
      showToast("Your account has been deleted.");
    } catch (err) {
      showToast(
        `Couldn't delete your account: ${(err as Error).message}. Try again or contact support.`,
      );
    } finally {
      setDeleting(false);
    }
  }

  return { deleting, run };
}
