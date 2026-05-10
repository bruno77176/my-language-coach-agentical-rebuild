import { forwardRef, useCallback, useState } from "react";
import {
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import { Alert, Pressable, StyleSheet, Text } from "react-native";

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

    const renderFooter = useCallback(
      (props: BottomSheetFooterProps) => (
        <BottomSheetFooter {...props} bottomInset={24}>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveButton, saving && styles.disabled]}
          >
            <Text style={styles.saveText}>{saving ? "Saving…" : "Save"}</Text>
          </Pressable>
        </BottomSheetFooter>
      ),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [saving, value],
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={["75%"]}
        footerComponent={renderFooter}
      >
        <BottomSheetView style={styles.header}>
          <Text style={styles.title}>Daily goal</Text>
        </BottomSheetView>
        <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
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
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 18, fontWeight: "600", color: "#111827" },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 100 },
  option: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 6,
  },
  optionSelected: { backgroundColor: "#dbeafe" },
  optionText: { fontSize: 16, color: "#374151" },
  optionTextSelected: { color: "#1d4ed8", fontWeight: "600" },
  saveButton: {
    marginHorizontal: 24,
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  saveText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.5 },
});
