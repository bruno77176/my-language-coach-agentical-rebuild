import { useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import { useCompleteOnboarding } from "@/src/features/onboarding/use-complete-onboarding";
import { useOnboardingStore } from "@/src/features/onboarding/onboarding-store";

const GOAL_OPTIONS = [3, 5, 10, 15, 20];

export default function DailyGoalStep() {
  const initial = useOnboardingStore((s) => s.dailyGoalMinutes);
  const setDailyGoalMinutes = useOnboardingStore((s) => s.setDailyGoalMinutes);
  const [selected, setSelected] = useState(initial);
  const mutation = useCompleteOnboarding();

  const onFinish = async () => {
    setDailyGoalMinutes(selected);
    try {
      await mutation.mutateAsync();
      // The auth listener + profile query detect the new profile,
      // and the root index gate redirects to /(tabs)/home.
    } catch (err) {
      Alert.alert("Couldn't complete onboarding", String(err));
    }
  };

  return (
    <View className="flex-1 justify-center bg-white px-6">
      <Text className="mb-2 text-3xl font-bold">Daily practice goal</Text>
      <Text className="mb-6 text-gray-600">How many minutes per day?</Text>
      {GOAL_OPTIONS.map((m) => {
        const isSelected = selected === m;
        return (
          <TouchableOpacity
            key={m}
            onPress={() => setSelected(m)}
            className={`mb-2 rounded-lg border p-4 ${
              isSelected ? "border-blue-600 bg-blue-50" : "border-gray-200"
            }`}
          >
            <Text className="text-base font-medium">{m} minutes</Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity
        onPress={onFinish}
        disabled={mutation.isPending}
        className={`mt-6 rounded-lg p-4 ${mutation.isPending ? "bg-gray-300" : "bg-blue-600"}`}
      >
        <Text className="text-center text-base font-semibold text-white">
          {mutation.isPending ? "Setting up…" : "Start practicing"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
