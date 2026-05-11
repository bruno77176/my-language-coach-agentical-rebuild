import { forwardRef, useCallback, useState } from "react";
import {
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { EditorialText, GlassCard } from "@/src/design";
import { LANGUAGES, type SupportedLang } from "@language-coach/shared";
import {
  palette,
  radius,
  shadow,
  spacing,
  touch,
} from "@language-coach/design-tokens";

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
            <EditorialText
              kind="bodyLg"
              color={palette.peach}
              style={{ fontWeight: "600" }}
            >
              {saving ? "Saving…" : "Save"}
            </EditorialText>
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
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView style={styles.header}>
          <EditorialText kind="displayMd">{title}</EditorialText>
        </BottomSheetView>
        <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
          {LANGUAGES.map((item) => {
            const selected = item.code === value;
            return (
              <Pressable
                key={item.code}
                onPress={() => setValue(item.code as SupportedLang)}
                style={styles.rowPressable}
              >
                <GlassCard
                  padding="md"
                  radiusToken="md"
                  style={selected ? styles.rowCardSelected : undefined}
                >
                  <View style={styles.rowInner}>
                    <EditorialText kind="bodyMd">{item.flag}</EditorialText>
                    <EditorialText
                      kind="bodyMd"
                      color={selected ? palette.accent : palette.ink}
                      style={styles.rowLabel}
                    >
                      {item.englishName}
                    </EditorialText>
                    <EditorialText kind="bodySm" color={palette.inkSoft}>
                      {item.nativeName}
                    </EditorialText>
                    {selected && (
                      <EditorialText kind="bodyMd" color={palette.accent}>
                        {"✓"}
                      </EditorialText>
                    )}
                  </View>
                </GlassCard>
              </Pressable>
            );
          })}
        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  background: {
    backgroundColor: palette.peach,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  handle: { backgroundColor: palette.glassFaint },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 100,
    gap: spacing.sm,
  },
  rowPressable: { minHeight: touch.min, justifyContent: "center" },
  rowCardSelected: {
    borderWidth: 1,
    borderColor: palette.accent,
  },
  rowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  rowLabel: { flex: 1 },
  saveButton: {
    backgroundColor: palette.ink,
    paddingVertical: spacing.base + 2,
    borderRadius: radius.lg,
    alignItems: "center",
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    ...shadow.cta,
  },
  disabled: { opacity: 0.5 },
});
