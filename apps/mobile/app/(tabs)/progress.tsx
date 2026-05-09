import { Text, View } from "react-native";

export default function ProgressScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white p-6">
      <Text className="mb-2 text-2xl font-bold">Progress</Text>
      <Text className="text-center text-gray-600">
        Streak calendar + minutes-per-day stats land in Plan 5.
      </Text>
    </View>
  );
}
