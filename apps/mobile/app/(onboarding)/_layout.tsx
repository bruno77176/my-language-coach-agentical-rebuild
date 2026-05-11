import { Stack } from "expo-router";
import { Image, StyleSheet, View } from "react-native";
import { Screen } from "@/src/design";
import { spacing } from "@language-coach/design-tokens";
import headerMark from "../../assets/header-icon.png";

export default function OnboardingLayout() {
  return (
    <Screen variant="gradient">
      <View style={styles.brand}>
        <Image source={headerMark} style={styles.mark} />
      </View>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "transparent" },
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  mark: { width: 36, height: 36 },
});
