import { useRef } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  BottomSheetModalProvider,
  type BottomSheetModal,
} from "@gorhom/bottom-sheet";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { LANGUAGES, type SupportedLang } from "@language-coach/shared";
import { palette, radius, spacing } from "@language-coach/design-tokens";
import { useProfile } from "@/src/features/auth/use-profile";
import { supabase } from "@/src/lib/supabase";
import { useUpdateProfile } from "@/src/features/profile/use-update-profile";
import { ProfileRow } from "@/src/features/profile/profile-row";
import { EditNameSheet } from "@/src/features/profile/edit-name-sheet";
import { EditGoalSheet } from "@/src/features/profile/edit-goal-sheet";
import { EditLanguageSheet } from "@/src/features/profile/edit-language-sheet";
import { SignInMethodsSheet } from "@/src/features/profile/sign-in-methods-sheet";
import { ChangePasswordSheet } from "@/src/features/profile/change-password-sheet";
import { DeleteAccountSheet } from "@/src/features/profile/delete-account-sheet";
import { useIdentities } from "@/src/features/auth/use-identities";
import { showToast } from "@/src/lib/toast";
import {
  EditorialText,
  GlassCard,
  Screen,
  TAB_BAR_RESERVE,
} from "@/src/design";

function langDisplay(code: string): string {
  const lang = LANGUAGES.find((l) => l.code === code);
  return lang ? `${lang.flag} ${lang.englishName}` : code;
}

function avatarColorFor(userId: string): string {
  // Sunrise-palette-only options — no purple/teal/mint to avoid clashing
  // with the warm gradient.
  const colors = [
    palette.accent,
    palette.coral,
    palette.mauve,
    "#e8b390", // warm sand
    "#c9b89e", // soft beige
  ];
  let h = 0;
  for (const c of userId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return colors[h % colors.length] ?? palette.accent;
}

export default function ProfileScreen() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const update = useUpdateProfile(profile?.user_id ?? "");
  const nameRef = useRef<BottomSheetModal>(null);
  const nativeRef = useRef<BottomSheetModal>(null);
  const targetRef = useRef<BottomSheetModal>(null);
  const goalRef = useRef<BottomSheetModal>(null);
  const signInMethodsRef = useRef<BottomSheetModal>(null);
  const changePasswordRef = useRef<BottomSheetModal>(null);
  const deleteAccountRef = useRef<BottomSheetModal>(null);
  const identities = useIdentities();
  const hasEmailIdentity = identities.some((i) => i.provider === "email");

  if (!profile) return null;

  const email = (profile as { email?: string }).email ?? "";

  const onSignOut = () => {
    Alert.alert("Sign out?", "You'll need to sign in again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          supabase.auth.signOut();
        },
      },
    ]);
  };

  const initial = profile.display_name?.[0]?.toUpperCase() ?? "?";
  const version = Constants.expoConfig?.version ?? "?";
  // expoConfig holds both platform blocks regardless of which one we're
  // running on, so a `??` chain that starts with android.versionCode would
  // also show that number to iOS users. Branch on Platform.OS instead.
  const buildNumber =
    (Platform.OS === "ios"
      ? Constants.expoConfig?.ios?.buildNumber
      : Constants.expoConfig?.android?.versionCode) ?? "?";

  return (
    <BottomSheetModalProvider>
      <Screen variant="gradient">
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <EditorialText kind="displayLg" style={styles.title}>
            Profile
          </EditorialText>

          {/* Header card: avatar + name/email */}
          <GlassCard padding="md" radiusToken="lg">
            <View style={styles.headerRow}>
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: avatarColorFor(profile.user_id) },
                ]}
              >
                <EditorialText
                  kind="displayMd"
                  color={palette.ink}
                  style={styles.avatarText}
                >
                  {initial}
                </EditorialText>
              </View>
              <View style={styles.headerText}>
                <EditorialText kind="bodyLg" color={palette.ink}>
                  {profile.display_name ?? ""}
                </EditorialText>
                <EditorialText
                  kind="bodySm"
                  color={palette.inkSoft}
                  style={styles.emailText}
                >
                  {(profile as { email?: string }).email ?? ""}
                </EditorialText>
              </View>
            </View>
          </GlassCard>

          {/* ACCOUNT section */}
          <EditorialText
            kind="caps"
            color={palette.inkSoft}
            style={styles.sectionLabel}
          >
            Account
          </EditorialText>
          <GlassCard padding="sm" radiusToken="lg" style={styles.sectionCard}>
            <ProfileRow
              label="Display name"
              value={profile.display_name ?? ""}
              onPress={() => nameRef.current?.present()}
            />
            <ProfileRow
              label="Email"
              value={(profile as { email?: string }).email ?? ""}
              onPress={() => router.push("/(auth)/change-email")}
            />
            {hasEmailIdentity ? (
              <ProfileRow
                label="Change password"
                value="•••••••"
                onPress={() => changePasswordRef.current?.present()}
              />
            ) : null}
            <ProfileRow
              label="Native language"
              value={langDisplay(profile.native_lang)}
              onPress={() => nativeRef.current?.present()}
            />
            <ProfileRow
              label="Learning"
              value={langDisplay(profile.target_lang)}
              onPress={() => targetRef.current?.present()}
            />
            <ProfileRow
              label="Sign-in methods"
              value="Manage"
              onPress={() => signInMethodsRef.current?.present()}
            />
            <ProfileRow
              label="Daily goal"
              value={`${profile.daily_goal_minutes} min`}
              onPress={() => goalRef.current?.present()}
              isLast
            />
          </GlassCard>

          {/* COACH section */}
          <EditorialText
            kind="caps"
            color={palette.inkSoft}
            style={styles.sectionLabel}
          >
            Coach
          </EditorialText>
          <GlassCard padding="sm" radiusToken="lg" style={styles.sectionCard}>
            <ProfileRow
              label="Coach's Memory"
              value="View & edit"
              onPress={() => router.push("/(tabs)/profile/memory")}
              isLast
            />
          </GlassCard>

          {/* DEV section — only in development builds */}
          {__DEV__ && (
            <>
              <EditorialText
                kind="caps"
                color={palette.inkSoft}
                style={styles.sectionLabel}
              >
                Dev
              </EditorialText>
              <GlassCard
                padding="sm"
                radiusToken="lg"
                style={styles.sectionCard}
              >
                <ProfileRow
                  label="🎛 Voice Lab"
                  value="Test voices"
                  onPress={() => router.push("/(tabs)/profile/voice-lab")}
                  isLast
                />
              </GlassCard>
            </>
          )}

          {/* PLAN section */}
          <EditorialText
            kind="caps"
            color={palette.inkSoft}
            style={styles.sectionLabel}
          >
            Plan
          </EditorialText>
          <GlassCard padding="sm" radiusToken="lg" style={styles.sectionCard}>
            <ProfileRow
              label="Upgrade to Pro"
              value="Coming soon"
              onPress={() =>
                showToast("Pro launches soon — we'll let you know.")
              }
              isLast
            />
          </GlassCard>

          {/* Sign out */}
          <Pressable onPress={onSignOut} style={styles.signOutButton}>
            <EditorialText
              kind="bodyLg"
              color={palette.danger}
              style={styles.signOutText}
            >
              Sign out
            </EditorialText>
          </Pressable>

          {/* Delete account */}
          <Pressable
            onPress={() => {
              console.log("[Profile] Delete account pressed");
              deleteAccountRef.current?.present();
            }}
            style={({ pressed }) => [
              styles.deleteAccountRow,
              pressed && styles.deleteAccountRowPressed,
            ]}
            hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
          >
            <EditorialText
              kind="bodyMd"
              color={palette.danger}
              align="center"
              style={styles.deleteAccountText}
            >
              Delete account
            </EditorialText>
          </Pressable>

          {/* Version */}
          <EditorialText kind="bodySm" color={palette.inkSoft} align="center">
            v{version} (build {buildNumber})
          </EditorialText>

          <EditNameSheet
            ref={nameRef}
            initialValue={profile.display_name ?? ""}
            onSave={async (display_name) => {
              await update.mutateAsync({ display_name });
            }}
          />
          <EditLanguageSheet
            ref={nativeRef}
            title="Native language"
            initialValue={profile.native_lang as SupportedLang}
            onSave={async (native_lang) => {
              await update.mutateAsync({ native_lang });
            }}
          />
          <EditLanguageSheet
            ref={targetRef}
            title="Learning"
            initialValue={profile.target_lang as SupportedLang}
            onSave={async (target_lang) => {
              await update.mutateAsync({ target_lang });
            }}
          />
          <EditGoalSheet
            ref={goalRef}
            initialValue={profile.daily_goal_minutes}
            onSave={async (daily_goal_minutes) => {
              await update.mutateAsync({ daily_goal_minutes });
            }}
          />
          <SignInMethodsSheet ref={signInMethodsRef} />
          {hasEmailIdentity ? (
            <ChangePasswordSheet ref={changePasswordRef} email={email} />
          ) : null}
          <DeleteAccountSheet
            ref={deleteAccountRef}
            email={email}
            hasEmailIdentity={hasEmailIdentity}
          />
        </ScrollView>
      </Screen>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: TAB_BAR_RESERVE + spacing.xl,
    gap: spacing.lg,
  },
  title: {
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    lineHeight: 52,
  },
  headerText: {
    flex: 1,
  },
  emailText: {
    marginTop: 2,
  },
  sectionLabel: {
    marginTop: spacing.sm,
    marginLeft: spacing.sm,
  },
  sectionCard: {
    paddingHorizontal: 0,
  },
  signOutButton: {
    backgroundColor: palette.dangerSurface,
    borderRadius: radius.lg,
    paddingVertical: spacing.base,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  signOutText: {
    fontWeight: "600",
  },
  deleteAccountRow: {
    marginTop: spacing.md,
    paddingVertical: spacing.base,
    paddingHorizontal: spacing.xl,
    alignSelf: "center",
    alignItems: "center",
    borderRadius: radius.lg,
  },
  deleteAccountRowPressed: {
    opacity: 0.5,
    backgroundColor: palette.dangerSurface,
  },
  deleteAccountText: {
    textDecorationLine: "underline",
  },
});
