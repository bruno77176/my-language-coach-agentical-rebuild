import { StyleSheet, Text, View } from "react-native";
import { useProfile } from "@/src/features/auth/use-profile";

export default function HomeScreen() {
  const { data: profile } = useProfile();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hi {profile?.display_name ?? "there"} 👋</Text>
      <Text style={styles.subtitle}>
        Your home screen will live here. Practice flow comes in Plan 4.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
  },
});
