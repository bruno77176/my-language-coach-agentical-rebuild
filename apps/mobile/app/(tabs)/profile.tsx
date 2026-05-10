import { useRef } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  BottomSheetModalProvider,
  type BottomSheetModal,
} from "@gorhom/bottom-sheet";
import Constants from "expo-constants";
import { LANGUAGES, type SupportedLang } from "@language-coach/shared";
import { useProfile } from "@/src/features/auth/use-profile";
import { supabase } from "@/src/lib/supabase";
import { useUpdateProfile } from "@/src/features/profile/use-update-profile";
import { ProfileRow } from "@/src/features/profile/profile-row";
import { EditNameSheet } from "@/src/features/profile/edit-name-sheet";
import { EditGoalSheet } from "@/src/features/profile/edit-goal-sheet";
import { EditLanguageSheet } from "@/src/features/profile/edit-language-sheet";
import { showToast } from "@/src/lib/toast";

function langDisplay(code: string): string {
  const lang = LANGUAGES.find((l) => l.code === code);
  return lang ? `${lang.flag} ${lang.englishName}` : code;
}

function avatarColorFor(userId: string): string {
  const colors = ["#fda4af", "#a7f3d0", "#bfdbfe", "#fcd34d", "#c4b5fd", "#fdba74"];
  let h = 0;
  for (const c of userId) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return colors[h % colors.length] ?? "#bfdbfe";
}

export default function ProfileScreen() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile(profile?.user_id ?? "");
  const nameRef = useRef<BottomSheetModal>(null);
  const nativeRef = useRef<BottomSheetModal>(null);
  const targetRef = useRef<BottomSheetModal>(null);
  const goalRef = useRef<BottomSheetModal>(null);

  if (!profile) return null;

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
  const buildNumber =
    Constants.expoConfig?.android?.versionCode ??
    Constants.expoConfig?.ios?.buildNumber ??
    "?";

  return (
    <BottomSheetModalProvider>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profile</Text>

        <View style={styles.headerCard}>
          <View
            style={[
              styles.avatar,
              { backgroundColor: avatarColorFor(profile.user_id) },
            ]}
          >
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.displayName}>{profile.display_name ?? ""}</Text>
            <Text style={styles.email}>
              {(profile as { email?: string }).email ?? ""}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.section}>
          <ProfileRow
            label="Display name"
            value={profile.display_name ?? ""}
            onPress={() => nameRef.current?.present()}
          />
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
            label="Daily goal"
            value={`${profile.daily_goal_minutes} min`}
            onPress={() => goalRef.current?.present()}
          />
        </View>

        <Text style={styles.sectionLabel}>PLAN</Text>
        <View style={styles.section}>
          <ProfileRow
            label="✨ Upgrade to Pro"
            value="Coming soon"
            onPress={() =>
              showToast("Pro launches soon — we'll let you know.")
            }
          />
        </View>

        <TouchableOpacity onPress={onSignOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>
          v{version} (build {buildNumber})
        </Text>

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
      </ScrollView>
    </BottomSheetModalProvider>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 48, backgroundColor: "#f3f4f6", flexGrow: 1 },
  title: { fontSize: 24, fontWeight: "700", color: "#111827", marginBottom: 16, marginLeft: 8 },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 22, fontWeight: "700", color: "#111827" },
  headerText: { flex: 1 },
  displayName: { fontSize: 18, fontWeight: "600", color: "#111827" },
  email: { fontSize: 13, color: "#6b7280", marginTop: 2 },
  sectionLabel: {
    fontSize: 12,
    color: "#6b7280",
    letterSpacing: 0.5,
    marginLeft: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  section: { backgroundColor: "#ffffff", borderRadius: 12, overflow: "hidden" },
  signOutButton: {
    backgroundColor: "#fee2e2",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
    marginHorizontal: 0,
  },
  signOutText: { color: "#b91c1c", fontSize: 16, fontWeight: "600" },
  version: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 32,
  },
});
