import { forwardRef, useState } from "react";
import {
  BottomSheetFlatList,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { Pressable, StyleSheet, Text } from "react-native";
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
      } finally {
        setSaving(false);
      }
    }

    return (
      <BottomSheetModal ref={ref} snapPoints={["75%"]}>
        <BottomSheetView style={styles.content}>
          <Text style={styles.title}>{title}</Text>
          <BottomSheetFlatList
            data={LANGUAGES}
            keyExtractor={(l) => l.code}
            style={styles.list}
            renderItem={({ item }) => {
              const selected = item.code === value;
              return (
                <Pressable
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
            }}
          />
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
  content: { padding: 24, gap: 12, flex: 1 },
  title: { fontSize: 18, fontWeight: "600", color: "#111827" },
  list: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 12,
  },
  rowSelected: { backgroundColor: "#dbeafe" },
  flag: { fontSize: 20 },
  rowLabel: { fontSize: 16, color: "#374151", flex: 1 },
  rowLabelSelected: { color: "#1d4ed8", fontWeight: "600" },
  native: { fontSize: 13, color: "#6b7280" },
  button: {
    backgroundColor: "#2563eb",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  disabled: { opacity: 0.5 },
});
