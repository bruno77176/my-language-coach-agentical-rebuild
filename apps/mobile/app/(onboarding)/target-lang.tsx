import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { LANGUAGES } from "@language-coach/shared";
import { useOnboardingStore } from "@/src/features/onboarding/onboarding-store";

export default function TargetLangStep() {
  const selected = useOnboardingStore((s) => s.targetLang);
  const setTargetLang = useOnboardingStore((s) => s.setTargetLang);

  return (
    <View className="flex-1 bg-white">
      <View className="px-6 pt-12">
        <Text className="mb-2 text-3xl font-bold">
          What language do you want to learn?
        </Text>
        <Text className="mb-6 text-gray-600">You can change this later.</Text>
      </View>
      <ScrollView className="flex-1 px-6">
        {LANGUAGES.map((lang) => {
          const isSelected = selected === lang.code;
          return (
            <TouchableOpacity
              key={lang.code}
              onPress={() => setTargetLang(lang.code)}
              className={`mb-2 flex-row items-center rounded-lg border p-4 ${
                isSelected ? "border-blue-600 bg-blue-50" : "border-gray-200"
              }`}
            >
              <Text className="mr-3 text-2xl">{lang.flag}</Text>
              <View className="flex-1">
                <Text className="text-base font-medium">
                  {lang.englishName}
                </Text>
                <Text className="text-sm text-gray-500">{lang.nativeName}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View className="border-t border-gray-100 bg-white p-6">
        <TouchableOpacity
          onPress={() => router.push("/(onboarding)/daily-goal")}
          disabled={!selected}
          className={`rounded-lg p-4 ${selected ? "bg-blue-600" : "bg-gray-300"}`}
        >
          <Text className="text-center text-base font-semibold text-white">
            Next
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
