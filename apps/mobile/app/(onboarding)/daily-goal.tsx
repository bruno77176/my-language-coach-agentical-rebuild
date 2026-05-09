import { useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
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
      // Navigate directly to /(tabs)/home — the mutation's onSuccess awaited
      // the profile refetch, so going through the index gate would also work,
      // but going direct skips an extra render cycle.
      router.replace("/(tabs)/home");
    } catch (err) {
      Alert.alert("Couldn't complete onboarding", String(err));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Daily practice goal</Text>
      <Text style={styles.subtitle}>How many minutes per day?</Text>
      {GOAL_OPTIONS.map((m) => {
        const isSelected = selected === m;
        return (
          <TouchableOpacity
            key={m}
            onPress={() => setSelected(m)}
            style={[
              styles.row,
              isSelected ? styles.rowSelected : styles.rowUnselected,
            ]}
          >
            <Text style={styles.rowText}>{m} minutes</Text>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity
        onPress={onFinish}
        disabled={mutation.isPending}
        style={[styles.button, mutation.isPending && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>
          {mutation.isPending ? "Setting up…" : "Start practicing"}
        </Text>
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
  row: {
    padding: 14,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 8,
  },
  rowSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#dbeafe",
  },
  rowUnselected: {
    borderColor: "#e5e7eb",
  },
  rowText: {
    fontSize: 16,
    fontWeight: "500",
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
