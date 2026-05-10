import { forwardRef, useState } from "react";
import {
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
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

    return (
      <BottomSheetModal ref={ref} snapPoints={["90%"]}>
        <BottomSheetView style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <BottomSheetScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
          >
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
                    style={[
                      styles.rowLabel,
                      selected && styles.rowLabelSelected,
                    ]}
                  >
                    {item.englishName}
                  </Text>
                  <Text style={styles.native}>{item.nativeName}</Text>
                </Pressable>
              );
            })}
          </BottomSheetScrollView>
          <View style={styles.footer}>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={[styles.button, saving && styles.disabled]}
            >
              <Text style={styles.buttonText}>
                {saving ? "Saving…" : "Save"}
              </Text>
            </Pressable>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 16 },
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
  footer: {
    paddingTop: 16,
    paddingBottom: 48,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e5e7eb",
  },
  button: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.5 },
});
