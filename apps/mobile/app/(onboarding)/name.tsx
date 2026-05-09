import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
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

  const isDisabled = !value.trim();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>What&apos;s your name?</Text>
      <Text style={styles.subtitle}>
        Your coach will use this to greet you.
      </Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Your first name"
        autoCapitalize="words"
        style={styles.input}
      />
      <TouchableOpacity
        onPress={onNext}
        disabled={isDisabled}
        style={[styles.button, isDisabled && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>Next</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    backgroundColor: "#ffffff",
    color: "#111827",
  },
  button: {
    marginTop: 24,
    backgroundColor: "#2563eb",
    borderRadius: 8,
    padding: 14,
  },
  buttonDisabled: {
    backgroundColor: "#d1d5db",
  },
  buttonText: {
    color: "#ffffff",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
});
