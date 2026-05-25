import { forwardRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import {
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { supabase } from "@/src/lib/supabase";
import { showToast } from "@/src/lib/toast";
import { EditorialText, GlassCard } from "@/src/design";
import {
  palette,
  radius,
  spacing,
} from "@language-coach/design-tokens";
import {
  signInWithGoogle,
  signInWithApple,
  SocialSignInCancelled,
} from "@/src/features/auth/social-sign-in";
import {
  canUnlink,
  useIdentities,
  type Identity,
  type IdentityProvider,
} from "@/src/features/auth/use-identities";

const PROVIDER_LABEL: Record<IdentityProvider, string> = {
  email: "Email & password",
  google: "Google",
  apple: "Apple",
};

export const SignInMethodsSheet = forwardRef<BottomSheetModal>(
  function SignInMethodsSheet(_, ref) {
    const identities = useIdentities();
    const [busy, setBusy] = useState<IdentityProvider | null>(null);

    const linked = new Set(identities.map((i) => i.provider));
    const canLinkGoogle = !linked.has("google");
    const canLinkApple = Platform.OS === "ios" && !linked.has("apple");

    const onLink = async (provider: "google" | "apple") => {
      setBusy(provider);
      try {
        // Calling signInWith* while authenticated, with Supabase's auto-link
        // setting on, attaches the new identity to the current user.
        if (provider === "google") await signInWithGoogle();
        else await signInWithApple();
        showToast(`${PROVIDER_LABEL[provider]} linked.`);
      } catch (err) {
        if (err instanceof SocialSignInCancelled) return;
        const msg = err instanceof Error ? err.message : "";
        if (/unconfirmed|not confirmed|email not verified|verify your email/i.test(msg)) {
          showToast(
            "This email has an unconfirmed account. Check your inbox or use Forgot password.",
          );
        } else {
          showToast(`Couldn't link ${PROVIDER_LABEL[provider]}.`);
        }
      } finally {
        setBusy(null);
      }
    };

    const onUnlink = async (identity: Identity) => {
      if (!canUnlink(identities, identity)) return;
      setBusy(identity.provider);
      const { error } = await supabase.auth.unlinkIdentity({
        identity_id: identity.identityId,
        id: identity.id,
        provider: identity.provider,
      } as never);
      setBusy(null);
      if (error) {
        showToast(error.message);
        return;
      }
      showToast(`${PROVIDER_LABEL[identity.provider]} unlinked.`);
    };

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={["55%"]}
        backgroundStyle={styles.background}
        handleIndicatorStyle={styles.handle}
      >
        <BottomSheetView style={styles.content}>
          <EditorialText kind="displayMd" style={styles.title}>
            Sign-in methods
          </EditorialText>
          <GlassCard padding="sm" radiusToken="lg">
            {identities.map((identity, idx) => {
              const unlinkable = canUnlink(identities, identity);
              return (
                <View
                  key={identity.id}
                  style={[
                    styles.row,
                    idx < identities.length - 1 && styles.rowDivider,
                  ]}
                >
                  <EditorialText kind="bodyLg" color={palette.ink}>
                    {PROVIDER_LABEL[identity.provider]}
                  </EditorialText>
                  <Pressable
                    onPress={() => onUnlink(identity)}
                    disabled={!unlinkable || busy !== null}
                    style={styles.action}
                  >
                    <EditorialText
                      kind="bodyMd"
                      color={unlinkable ? palette.danger : palette.inkSoft}
                    >
                      {busy === identity.provider ? "…" : "Unlink"}
                    </EditorialText>
                  </Pressable>
                </View>
              );
            })}
          </GlassCard>

          {identities.length === 1 ? (
            <EditorialText
              kind="bodySm"
              color={palette.inkSoft}
              style={styles.helper}
            >
              You need at least one way to sign in.
            </EditorialText>
          ) : null}

          {canLinkGoogle ? (
            <Pressable
              onPress={() => onLink("google")}
              disabled={busy !== null}
              style={styles.linkButton}
            >
              <EditorialText kind="bodyLg" color={palette.ink}>
                {busy === "google" ? "Linking…" : "Link Google"}
              </EditorialText>
            </Pressable>
          ) : null}
          {canLinkApple ? (
            <Pressable
              onPress={() => onLink("apple")}
              disabled={busy !== null}
              style={styles.linkButton}
            >
              <EditorialText kind="bodyLg" color={palette.ink}>
                {busy === "apple" ? "Linking…" : "Link Apple"}
              </EditorialText>
            </Pressable>
          ) : null}
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
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  title: { marginBottom: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.glassFaint,
  },
  action: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  helper: { marginTop: -spacing.xs, marginLeft: spacing.sm },
  linkButton: {
    backgroundColor: palette.glassFaint,
    paddingVertical: spacing.base,
    borderRadius: radius.lg,
    alignItems: "center",
  },
});
