import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuthStore } from "@/src/features/auth/auth-store";
import { useProfile } from "@/src/features/auth/use-profile";

export default function IndexGate() {
  const status = useAuthStore((s) => s.status);
  const { data: profile, isLoading } = useProfile();

  if (status === "loading" || (status === "authenticated" && isLoading)) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator />
      </View>
    );
  }

  if (status === "anonymous") {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!profile) {
    return <Redirect href="/(onboarding)/name" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
