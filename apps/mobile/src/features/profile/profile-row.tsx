import { Pressable, StyleSheet, Text, View } from "react-native";

type Props = {
  label: string;
  value: string;
  onPress: () => void;
};

export function ProfileRow({ label, value, onPress }: Props) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.rightCol}>
        <Text style={styles.value}>{value}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  label: { fontSize: 16, color: "#111827" },
  rightCol: { flexDirection: "row", alignItems: "center" },
  value: { fontSize: 16, color: "#6b7280", marginRight: 8 },
  chevron: { fontSize: 20, color: "#9ca3af" },
});
