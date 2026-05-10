import { forwardRef, useCallback, useState } from "react";
import {
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import { LANGUAGES, type SupportedLang } from "@language-coach/shared";

type Props = {
  title: string;
  initialValue: SupportedLang;
  onSave: (lang: SupportedLang) => Promise<void>;
};

export const EditLanguageSheet = forwardRef<BottomSheetModal, Props>(
  function EditLanguageSheet({ title, initialValue, onSave }, ref) {
    const [value, setValue] = useState<SupportedLang>(initialValue);
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
      [saving, value],
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={["85%"]}
        footerComponent={renderFooter}
      >
        <BottomSheetView style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </BottomSheetView>
        <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
          {LANGUAGES.map((item) => {
            const selected = item.code === value;
            return (
              <Pressable
                key={item.code}
                onPress={() => setValue(item.code as SupportedLang)}
                style={[styles.row, selected && styles.rowSelected]}
              >
                <Text style={styles.flag}>{item.flag}</Text>
                <Text
                  style={[styles.rowLabel, selected && styles.rowLabelSelected]}
                >
                  {item.englishName}
                </Text>
                <Text style={styles.native}>{item.nativeName}</Text>
              </Pressable>
            );
          })}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
  title: { fontSize: 18, fontWeight: "600", color: "#111827" },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100, // leave room for the floating footer
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 12,
    marginBottom: 4,
  },
  rowSelected: { backgroundColor: "#dbeafe" },
  flag: { fontSize: 20 },
  rowLabel: { fontSize: 16, color: "#374151", flex: 1 },
  rowLabelSelected: { color: "#1d4ed8", fontWeight: "600" },
  native: { fontSize: 13, color: "#6b7280" },
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
