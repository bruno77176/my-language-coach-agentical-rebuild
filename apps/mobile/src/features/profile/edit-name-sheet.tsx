import { forwardRef, useCallback, useState } from "react";
import {
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetTextInput,
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
  type as typeTokens,
} from "@language-coach/design-tokens";

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
            style={[styles.saveButton, (!valid || saving) && styles.disabled]}
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
      [saving, valid, value],
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={["50%"]}
        footerComponent={renderFooter}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView style={styles.content}>
          <View style={styles.titleRow}>
            <EditorialText kind="displayMd">Display name</EditorialText>
          </View>
          <GlassCard padding="md">
            <BottomSheetTextInput
              value={value}
              onChangeText={setValue}
              placeholder="Your name"
              maxLength={30}
              autoFocus
              style={[typeTokens.bodyLg, styles.input]}
              placeholderTextColor={palette.inkSoft}
            />
          </GlassCard>
        </BottomSheetView>
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
  content: { paddingHorizontal: spacing.xl, paddingBottom: spacing.base },
  titleRow: {
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  input: {
    color: palette.ink,
    padding: 0,
    minHeight: 28,
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
