import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useOnboardingStore } from "@/src/features/onboarding/onboarding-store";

export default function NameStep() {
  const initial = useOnboardingStore((s) => s.displayName);
  const setDisplayName = useOnboardingStore((s) => s.setDisplayName);
  const [value, setValue] = useState(initial);

  const onNext = () => {
    if (!value.trim()) return;
    setDisplayName(value.trim());
    router.push("/(onboarding)/native-lang");
  };

  return (
    <View className="flex-1 justify-center bg-white px-6">
      <Text className="mb-2 text-3xl font-bold">What&apos;s your name?</Text>
      <Text className="mb-6 text-gray-600">
        Your coach will use this to greet you.
      </Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Your first name"
        autoCapitalize="words"
        className="rounded-lg border border-gray-300 p-4 text-base"
      />
      <TouchableOpacity
        onPress={onNext}
        disabled={!value.trim()}
        className={`mt-6 rounded-lg p-4 ${value.trim() ? "bg-blue-600" : "bg-gray-300"}`}
      >
        <Text className="text-center text-base font-semibold text-white">
          Next
        </Text>
      </TouchableOpacity>
    </View>
  );
}
