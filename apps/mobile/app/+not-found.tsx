import { useRouter } from "expo-router";
import { Pressable, StyleSheet } from "react-native";
import { EditorialText, Screen } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";

export default function NotFound() {
  const router = useRouter();
  return (
    <Screen variant="gradient">
      <EditorialText kind="displayXl" align="center" style={styles.title}>
        Lost in translation.
      </EditorialText>
      <EditorialText
        kind="bodyMd"
        color={palette.inkSoft}
        align="center"
        style={styles.body}
      >
        We couldn&apos;t find what you were looking for.
      </EditorialText>
      <Pressable style={styles.cta} onPress={() => router.replace("/")}>
        <EditorialText kind="bodyLg" color={palette.peach}>
          Take me home
        </EditorialText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: spacing["3xl"] * 2,
    paddingHorizontal: spacing.xl,
  },
  body: { marginTop: spacing.md, paddingHorizontal: spacing.xl },
  cta: {
    backgroundColor: palette.ink,
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    paddingVertical: spacing.base + 2,
    borderRadius: radius.lg,
    alignItems: "center",
    ...shadow.cta,
  },
});
