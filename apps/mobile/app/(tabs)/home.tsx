import { Text, View } from "react-native";
import { useProfile } from "@/src/features/auth/use-profile";

export default function HomeScreen() {
  const { data: profile } = useProfile();
  return (
    <View className="flex-1 items-center justify-center bg-white p-6">
      <Text className="mb-2 text-2xl font-bold">
        Hi {profile?.display_name ?? "there"} 👋
      </Text>
      <Text className="text-center text-gray-600">
        Your home screen will live here. Practice flow comes in Plan 4.
      </Text>
    </View>
  );
}
