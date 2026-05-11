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
import {
  palette,
  radius,
  shadow,
  spacing,
  touch,
} from "@language-coach/design-tokens";

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
        snapPoints={["75%"]}
        footerComponent={renderFooter}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView style={styles.header}>
          <EditorialText kind="displayMd">Daily goal</EditorialText>
        </BottomSheetView>
        <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.pillRow}>
            {OPTIONS.map((opt) => {
              const selected = value === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => setValue(opt)}
                  style={styles.pillHit}
                >
                  {selected ? (
                    <View style={styles.pillSelected}>
                      <EditorialText kind="bodyMd" color={palette.peach}>
                        {opt} min
                      </EditorialText>
                    </View>
                  ) : (
                    <GlassCard radiusToken="pill" padding="md">
                      <EditorialText kind="bodyMd" color={palette.ink}>
                        {opt} min
                      </EditorialText>
                    </GlassCard>
                  )}
                </Pressable>
              );
            })}
          </View>
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
  scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: 100 },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  pillHit: { minHeight: touch.min, justifyContent: "center" },
  pillSelected: {
    backgroundColor: palette.ink,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    minHeight: touch.min,
    justifyContent: "center",
    alignItems: "center",
  },
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
