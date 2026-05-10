import { forwardRef, useState } from "react";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { Alert, Pressable, ScrollView, StyleSheet, Text } from "react-native";

type Props = {
  initialValue: number;
  onSave: (minutes: number) => Promise<void>;
};

const OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50, 60];

export const EditGoalSheet = forwardRef<BottomSheetModal, Props>(
  function EditGoalSheet({ initialValue, onSave }, ref) {
    const [value, setValue] = useState(initialValue);
    const [saving, setSaving] = useState(false);

    async function handleSave() {
      setSaving(true);
      try {
        await onSave(value);
        (ref as { current: BottomSheetModal | null }).current?.dismiss();
      } catch (err) {
        Alert.alert("Couldn't save", (err as Error).message);
      } finally {
        setSaving(false);
      }
    }

    return (
      <BottomSheetModal ref={ref} snapPoints={["50%"]}>
        <BottomSheetView style={styles.content}>
          <Text style={styles.title}>Daily goal</Text>
          <ScrollView style={styles.list}>
            {OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => setValue(opt)}
                style={[styles.option, value === opt && styles.optionSelected]}
              >
                <Text
                  style={[
                    styles.optionText,
                    value === opt && styles.optionTextSelected,
                  ]}
                >
                  {opt} min
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[styles.button, saving && styles.disabled]}
          >
            <Text style={styles.buttonText}>{saving ? "Saving…" : "Save"}</Text>
          </Pressable>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  content: { padding: 24, gap: 16, flex: 1 },
  title: { fontSize: 18, fontWeight: "600", color: "#111827" },
  list: { maxHeight: 280 },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  optionSelected: { backgroundColor: "#dbeafe" },
  optionText: { fontSize: 16, color: "#374151" },
  optionTextSelected: { color: "#1d4ed8", fontWeight: "600" },
  button: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.5 },
});
