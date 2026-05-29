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
import {
  palette,
  radius,
  shadow,
  spacing,
  type as typeTokens,
} from "@language-coach/design-tokens";
import { useDeleteAccount } from "./use-delete-account";

type Props = {
  email: string;
  hasEmailIdentity: boolean;
};

export const DeleteAccountSheet = forwardRef<BottomSheetModal, Props>(
  function DeleteAccountSheet({ email, hasEmailIdentity }, ref) {
    const insets = useSafeAreaInsets();
    const footerInset = insets.bottom + TAB_BAR_RESERVE;
    const [password, setPassword] = useState("");
    const [verifying, setVerifying] = useState(false);
    const { deleting, run } = useDeleteAccount();

    const handleConfirm = useCallback(async () => {
      if (hasEmailIdentity) {
        setVerifying(true);
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        setVerifying(false);
        if (error) {
          showToast("Password is incorrect.");
          return;
        }
      }
      // OAuth-only users: re-confirm via the destructive button alone for v1.
      // Server still verifies the user's JWT before deleting.
      await run();
      (ref as { current: BottomSheetModal | null }).current?.dismiss();
    }, [email, hasEmailIdentity, password, ref, run]);

    const busy = verifying || deleting;
    const valid = hasEmailIdentity ? password.length >= 1 : true;

    const renderFooter = useCallback(
      (props: BottomSheetFooterProps) => (
        <BottomSheetFooter {...props} bottomInset={footerInset}>
          <Pressable
            onPress={handleConfirm}
            disabled={busy || !valid}
            style={[styles.deleteButton, (busy || !valid) && styles.disabled]}
          >
            <EditorialText
              kind="bodyLg"
              color={palette.cream}
              style={{ fontWeight: "600" }}
            >
              {busy ? "Deleting…" : "Delete my account"}
            </EditorialText>
          </Pressable>
        </BottomSheetFooter>
      ),
      [busy, valid, handleConfirm, footerInset],
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
            <EditorialText kind="displayMd">Delete your account</EditorialText>
          </View>
          <EditorialText
            kind="bodyMd"
            color={palette.inkSoft}
            style={styles.body}
          >
            This will permanently delete your account and all your practice
            history. This cannot be undone.
          </EditorialText>
          {hasEmailIdentity ? (
            <GlassCard padding="md" style={styles.field}>
              <EditorialText
                kind="bodySm"
                color={palette.inkSoft}
                style={styles.fieldLabel}
              >
                Confirm your password
              </EditorialText>
              <BottomSheetTextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="password"
                autoCapitalize="none"
                style={[typeTokens.bodyLg, styles.input]}
                placeholderTextColor={palette.inkSoft}
              />
            </GlassCard>
          ) : (
            <EditorialText kind="bodySm" color={palette.inkSoft}>
              You'll be signed out and your account removed. Tap "Delete my
              account" below to proceed.
            </EditorialText>
          )}
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
  body: { marginBottom: spacing.md },
  field: { marginTop: spacing.sm },
  fieldLabel: { marginBottom: spacing.xs },
  input: { color: palette.ink, padding: 0, minHeight: 28 },
  deleteButton: {
    backgroundColor: palette.danger,
    paddingVertical: spacing.base + 2,
    borderRadius: radius.lg,
    alignItems: "center",
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    ...shadow.cta,
  },
  disabled: { opacity: 0.5 },
});
