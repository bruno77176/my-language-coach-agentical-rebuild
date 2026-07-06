import { useEffect, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useOnboardingStore } from "@/src/features/onboarding/onboarding-store";
import { useAuthStore } from "@/src/features/auth/auth-store";
import { GlassCard, EditorialText } from "@/src/design";
import {
  palette,
  spacing,
  radius,
  shadow,
  type,
} from "@language-coach/design-tokens";

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <View
      style={{ flexDirection: "row", gap: spacing.xs, paddingTop: spacing.sm }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: i === step ? palette.accent : palette.glassFaint,
          }}
        />
      ))}
    </View>
  );
}

// A name a federated provider already gave us. Apple supplies it in the
// credential (seeded into the onboarding store at sign-in); Google/others land
// it in Supabase user_metadata. Used to skip this step entirely so we never
// ask a Sign-in-with-Apple user to re-type their name (Guideline 4).
function providerName(meta: Record<string, unknown> | undefined): string {
  if (!meta) return "";
  const candidate = meta.full_name ?? meta.name ?? meta.given_name;
  return typeof candidate === "string" ? candidate.trim() : "";
}

export default function NameStep() {
  const initial = useOnboardingStore((s) => s.displayName);
  const setDisplayName = useOnboardingStore((s) => s.setDisplayName);
  const userMeta = useAuthStore((s) => s.session?.user?.user_metadata);

  const knownName = initial.trim() || providerName(userMeta);
  const [value, setValue] = useState(knownName);

  // If a provider already gave us a name, persist it and advance — don't make
  // the user re-enter it. Email/password signups (no name yet) still see this
  // screen. router.replace keeps it out of the back stack so there's no flash
  // of the name field on the way forward.
  useEffect(() => {
    if (knownName) {
      setDisplayName(knownName);
      router.replace("/(onboarding)/native-lang");
    }
    // Run once on mount: knownName/setDisplayName are derived from mount-time
    // store state and are stable for this screen's lifetime.
  }, []);

  const onNext = () => {
    if (!value.trim()) return;
    setDisplayName(value.trim());
    router.push("/(onboarding)/native-lang");
  };

  const isDisabled = !value.trim();

  // Mid-redirect (provider gave us a name): render nothing rather than flash
  // the name field for a frame.
  if (knownName) return null;

  return (
    <View style={styles.container}>
      <ProgressDots step={0} total={5} />

      <EditorialText kind="displayLg">What&apos;s your name?</EditorialText>
      <EditorialText kind="bodyMd" color={palette.inkSoft}>
        Your coach will use this to greet you.
      </EditorialText>

      <GlassCard padding="md">
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder="Your first name"
          autoCapitalize="words"
          placeholderTextColor={palette.inkSoft}
          style={[type.bodyLg, styles.input]}
        />
      </GlassCard>

      <View style={{ flex: 1 }} />

      <Pressable
        onPress={onNext}
        disabled={isDisabled}
        style={[styles.cta, isDisabled && styles.ctaDisabled]}
      >
        <EditorialText kind="bodyLg" color={palette.peach}>
          Continue
        </EditorialText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.base,
  },
  input: {
    color: palette.ink,
    padding: 0,
    minHeight: 28,
  },
  cta: {
    backgroundColor: palette.ink,
    paddingVertical: spacing.base + 2,
    borderRadius: radius.lg,
    alignItems: "center",
    marginBottom: spacing.lg,
    ...shadow.cta,
  },
  ctaDisabled: {
    opacity: 0.5,
  },
});
