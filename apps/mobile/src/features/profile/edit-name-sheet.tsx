import { forwardRef, useCallback, useState } from "react";
import {
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import { Alert, Pressable, StyleSheet, Text } from "react-native";

type Props = {
  initialValue: string;
  onSave: (value: string) => Promise<void>;
};

export const EditNameSheet = forwardRef<BottomSheetModal, Props>(
  function EditNameSheet({ initialValue, onSave }, ref) {
    const [value, setValue] = useState(initialValue);
    const [saving, setSaving] = useState(false);

    const trimmed = value.trim();
    const valid = trimmed.length >= 1 && trimmed.length <= 30;

    async function handleSave() {
      if (!valid) return;
      setSaving(true);
      try {
        await onSave(trimmed);
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
            disabled={!valid || saving}
            style={[
              styles.saveButton,
              (!valid || saving) && styles.disabled,
            ]}
          >
            <Text style={styles.saveText}>{saving ? "Saving…" : "Save"}</Text>
          </Pressable>
        </BottomSheetFooter>
      ),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [saving, valid, value],
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={["50%"]}
        footerComponent={renderFooter}
      >
        <BottomSheetView style={styles.content}>
          <Text style={styles.title}>Display name</Text>
          <BottomSheetTextInput
            value={value}
            onChangeText={setValue}
            placeholder="Your name"
            maxLength={30}
            autoFocus
            style={styles.input}
          />
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  content: { padding: 24, gap: 16 },
  title: { fontSize: 18, fontWeight: "600", color: "#111827" },
  input: {
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
  },
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
