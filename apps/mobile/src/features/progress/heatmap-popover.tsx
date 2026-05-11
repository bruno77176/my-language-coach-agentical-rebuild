import { Pressable, StyleSheet, View } from "react-native";
import { EditorialText, GlassCard } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";

type Props = {
  label: string;
  /** Anchor coordinates in screen-relative space (pageX/pageY from the tap event). */
  anchor: { x: number; y: number };
  /** Screen width to clamp against (so right-edge popovers don't overflow). */
  screenWidth: number;
  onDismiss: () => void;
};

const POPOVER_WIDTH = 200;

export function HeatmapPopover({
  label,
  anchor,
  screenWidth,
  onDismiss,
}: Props) {
  const left = Math.min(
    Math.max(spacing.md, anchor.x - POPOVER_WIDTH / 2),
    screenWidth - POPOVER_WIDTH - spacing.md,
  );
  const top = anchor.y - 64; // floats just above the tapped cell

  return (
    <>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDismiss}
        accessibilityLabel="Dismiss"
      />
      <View style={[styles.wrap, { top, left }]} pointerEvents="box-none">
        <GlassCard padding="md" radiusToken="md" strong style={styles.card}>
          <EditorialText kind="bodyMd" color={palette.ink}>
            {label}
          </EditorialText>
        </GlassCard>
        <View style={styles.tail} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", width: POPOVER_WIDTH, ...shadow.floating },
  card: { borderRadius: radius.md },
  tail: {
    position: "absolute",
    bottom: -6,
    left: POPOVER_WIDTH / 2 - 6,
    width: 12,
    height: 12,
    backgroundColor: palette.glassStrong,
    transform: [{ rotate: "45deg" }],
  },
});
