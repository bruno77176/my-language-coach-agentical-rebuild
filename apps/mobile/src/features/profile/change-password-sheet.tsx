import { forwardRef, useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import {
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/src/lib/supabase";
import { showToast } from "@/src/lib/toast";
import { EditorialText, GlassCard, TAB_BAR_RESERVE } from "@/src/design";
import { BottomSheetPasswordInput } from "@/src/design/BottomSheetPasswordInput";
import {
  palette,
  radius,
  shadow,
  spacing,
  type as typeTokens,
} from "@language-coach/design-tokens";

type Props = {
  email: string;
};

export const ChangePasswordSheet = forwardRef<BottomSheetModal, Props>(
  function ChangePasswordSheet({ email }, ref) {
    const insets = useSafeAreaInsets();
    const footerInset = insets.bottom + TAB_BAR_RESERVE;
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [saving, setSaving] = useState(false);

    const valid = current.length >= 1 && next.length >= 6;

    const handleSave = async () => {
      if (!valid) return;
      setSaving(true);
      // Verify current password first via silent sign-in
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (signInErr) {
        setSaving(false);
        showToast("Current password is incorrect.");
        return;
      }
      const { error: updateErr } = await supabase.auth.updateUser({
        password: next,
      });
      setSaving(false);
      if (updateErr) {
        showToast(updateErr.message);
        return;
      }
      showToast("Password updated.");
      setCurrent("");
      setNext("");
      (ref as { current: BottomSheetModal | null }).current?.dismiss();
    };

    const renderFooter = useCallback(
      (props: BottomSheetFooterProps) => (
        <BottomSheetFooter {...props} bottomInset={footerInset}>
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
              {saving ? "Saving…" : "Update password"}
            </EditorialText>
          </Pressable>
        </BottomSheetFooter>
      ),
      [saving, valid, current, next, footerInset],
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={["65%"]}
        footerComponent={renderFooter}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView style={styles.content}>
          <View style={styles.titleRow}>
            <EditorialText kind="displayMd">Change password</EditorialText>
          </View>
          <GlassCard padding="md" style={styles.field}>
            <EditorialText
              kind="bodySm"
              color={palette.inkSoft}
              style={styles.fieldLabel}
            >
              Current password
            </EditorialText>
            <BottomSheetPasswordInput
              value={current}
              onChangeText={setCurrent}
              placeholder="••••••"
              autoCapitalize="none"
              style={[typeTokens.bodyLg, styles.input]}
              placeholderTextColor={palette.inkSoft}
            />
          </GlassCard>
          <GlassCard padding="md" style={styles.field}>
            <EditorialText
              kind="bodySm"
              color={palette.inkSoft}
              style={styles.fieldLabel}
            >
              New password
            </EditorialText>
            <BottomSheetPasswordInput
              value={next}
              onChangeText={setNext}
              placeholder="At least 6 characters"
              autoCapitalize="none"
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
  titleRow: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  field: { marginTop: spacing.sm },
  fieldLabel: { marginBottom: spacing.xs },
  input: { color: palette.ink, padding: 0, minHeight: 28 },
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
