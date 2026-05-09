import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useProfile } from "@/src/features/auth/use-profile";
import { supabase } from "@/src/lib/supabase";

export default function ProfileScreen() {
  const { data: profile } = useProfile();

  const onSignOut = () => {
    Alert.alert("Sign out?", "You'll need to sign in again to see your data.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.displayName}>{profile?.display_name}</Text>
      <Text style={styles.info}>
        Native: {profile?.native_lang} · Learning: {profile?.target_lang} ·
        Goal: {profile?.daily_goal_minutes}min/day
      </Text>
      <TouchableOpacity onPress={onSignOut} style={styles.signOutButton}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 24,
  },
  displayName: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  info: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 32,
  },
  signOutButton: {
    backgroundColor: "#fee2e2",
    borderRadius: 8,
    padding: 14,
  },
  signOutText: {
    color: "#b91c1c",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
});
