import { Text, View } from "react-native";

export default function PracticeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white p-6">
      <Text className="mb-2 text-2xl font-bold">Practice</Text>
      <Text className="text-center text-gray-600">
        Voice loop lands in Plan 4. Tap below when it's ready.
      </Text>
    </View>
  );
}
