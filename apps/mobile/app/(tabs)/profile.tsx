import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useProfile } from "@/src/features/auth/use-profile";
import { supabase } from "@/src/lib/supabase";

export default function ProfileScreen() {
  const { data: profile } = useProfile();

  const onSignOut = () => {
    Alert.alert("Sign out?", "You'll need to sign in again to see your data.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-white p-6">
      <Text className="mb-1 text-3xl font-bold">{profile?.display_name}</Text>
      <Text className="mb-8 text-gray-600">
        Native: {profile?.native_lang} · Learning: {profile?.target_lang} ·
        Goal: {profile?.daily_goal_minutes}min/day
      </Text>
      <TouchableOpacity
        onPress={onSignOut}
        className="rounded-lg bg-red-100 p-4"
      >
        <Text className="text-center text-base font-semibold text-red-700">
          Sign out
        </Text>
      </TouchableOpacity>
    </View>
  );
}
