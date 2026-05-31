import { forwardRef, useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/src/lib/supabase";
import { showToast } from "@/src/lib/toast";
import { EditorialText, GlassCard } from "@/src/design";
import { BottomSheetPasswordInput } from "@/src/design/BottomSheetPasswordInput";
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
    const [password, setPassword] = useState("");
    const [verifying, setVerifying] = useState(false);
    const { deleting, run } = useDeleteAccount();

    const handleConfirm = useCallback(async () => {
      console.log("[DeleteAccountSheet] confirm tapped", { hasEmailIdentity });
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
      await run();
      (ref as { current: BottomSheetModal | null }).current?.dismiss();
    }, [email, hasEmailIdentity, password, ref, run]);

    const busy = verifying || deleting;
    const valid = hasEmailIdentity ? password.length >= 1 : true;

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={["65%"]}
        enableDynamicSizing={false}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView
          style={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
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
              <BottomSheetPasswordInput
                value={password}
                onChangeText={setPassword}
                placeholder="password"
                autoCapitalize="none"
                style={[typeTokens.bodyLg, styles.input]}
                placeholderTextColor={palette.inkSoft}
              />
            </GlassCard>
          ) : (
            <EditorialText
              kind="bodySm"
              color={palette.inkSoft}
              style={styles.body}
            >
              You'll be signed out and your account removed. Tap "Delete my
              account" below to proceed.
            </EditorialText>
          )}
          <View style={styles.spacer} />
          <Pressable
            onPress={handleConfirm}
            disabled={busy || !valid}
            style={({ pressed }) => [
              styles.deleteButton,
              (busy || !valid) && styles.disabled,
              pressed && styles.deleteButtonPressed,
            ]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <EditorialText
              kind="bodyLg"
              color={palette.cream}
              style={styles.deleteButtonText}
            >
              {busy ? "Deleting…" : "Delete my account"}
            </EditorialText>
          </Pressable>
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
  content: {
    flex: 1,
    paddingHorizontal: spacing.xl,
  },
  titleRow: { paddingTop: spacing.md, paddingBottom: spacing.lg },
  body: { marginBottom: spacing.md },
  field: { marginTop: spacing.sm },
  fieldLabel: { marginBottom: spacing.xs },
  input: { color: palette.ink, padding: 0, minHeight: 28 },
  spacer: { flex: 1 },
  deleteButton: {
    backgroundColor: palette.danger,
    paddingVertical: spacing.base + 2,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadow.cta,
  },
  deleteButtonText: { fontWeight: "600" },
  deleteButtonPressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
});
