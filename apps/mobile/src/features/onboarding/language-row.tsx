import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { EditorialText } from "@/src/design";
import { palette, radius, spacing, touch } from "@language-coach/design-tokens";

type Props = {
  code: string;
  englishName: string;
  nativeName: string;
  flag: string;
  isSelected: boolean;
  onPress: (code: string) => void;
};

// Plain translucent View instead of GlassCard — BlurView is GPU-expensive and
// rendering 12 of them in a list (then re-rendering all 12 on every selection
// change) is what made the native-lang / target-lang transitions feel laggy on
// mid-range Android. The row is on the sunrise gradient where a static
// translucent surface is visually indistinguishable from the blur effect.
function LanguageRowImpl({
  code,
  englishName,
  nativeName,
  flag,
  isSelected,
  onPress,
}: Props) {
  return (
    <Pressable onPress={() => onPress(code)} style={styles.pressable}>
      <View style={[styles.card, isSelected && styles.cardSelected]}>
        <EditorialText kind="bodyLg" style={styles.flag}>
          {flag}
        </EditorialText>
        <View style={styles.text}>
          <EditorialText kind="bodyMd" color={palette.ink}>
            {englishName}
          </EditorialText>
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            {nativeName}
          </EditorialText>
        </View>
        {isSelected && (
          <EditorialText kind="bodyMd" color={palette.accent}>
            ✓
          </EditorialText>
        )}
      </View>
    </Pressable>
  );
}

export const LanguageRow = memo(LanguageRowImpl);

const styles = StyleSheet.create({
  pressable: {
    minHeight: touch.min,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: palette.glassStrong,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: touch.min,
  },
  cardSelected: {
    borderWidth: 1,
    borderColor: palette.accent,
  },
  flag: {
    fontSize: 24,
  },
  text: {
    flex: 1,
  },
});
