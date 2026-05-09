import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { LANGUAGES } from "@language-coach/shared";
import { useOnboardingStore } from "@/src/features/onboarding/onboarding-store";

export default function TargetLangStep() {
  const selected = useOnboardingStore((s) => s.targetLang);
  const setTargetLang = useOnboardingStore((s) => s.setTargetLang);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>What language do you want to learn?</Text>
        <Text style={styles.subtitle}>You can change this later.</Text>
      </View>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
      >
        {LANGUAGES.map((lang) => {
          const isSelected = selected === lang.code;
          return (
            <TouchableOpacity
              key={lang.code}
              onPress={() => setTargetLang(lang.code)}
              style={[
                styles.row,
                isSelected ? styles.rowSelected : styles.rowUnselected,
              ]}
            >
              <Text style={styles.flag}>{lang.flag}</Text>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{lang.englishName}</Text>
                <Text style={styles.rowSubtitle}>{lang.nativeName}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={() => router.push("/(onboarding)/daily-goal")}
          disabled={!selected}
          style={[styles.button, !selected && styles.buttonDisabled]}
        >
          <Text style={styles.buttonText}>Next</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 48,
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
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
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
  flag: {
    fontSize: 24,
    marginRight: 12,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "500",
    color: "#111827",
  },
  rowSubtitle: {
    fontSize: 14,
    color: "#6b7280",
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    padding: 24,
    backgroundColor: "#ffffff",
  },
  button: {
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
