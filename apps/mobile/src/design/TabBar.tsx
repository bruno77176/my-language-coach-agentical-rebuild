import { Pressable, StyleSheet, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  palette,
  radius,
  shadow,
  spacing,
  touch,
} from "@language-coach/design-tokens";
import { EditorialText } from "./EditorialText";
import { GlassCard } from "./GlassCard";

/** Approximate visual height of the floating tab bar including its margin.
 * Screens with their own bottom-anchored content (e.g. Practice mic) should
 * reserve `TAB_BAR_RESERVE + insets.bottom` of padding to avoid overlap. */
export const TAB_BAR_RESERVE = 86;

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: "home-outline",
  practice: "chatbubble-ellipses-outline",
  progress: "stats-chart-outline",
  profile: "person-outline",
};

const ICONS_ACTIVE: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: "home",
  practice: "chatbubble-ellipses",
  progress: "stats-chart",
  profile: "person",
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[styles.wrap, { bottom: insets.bottom + spacing.md }]}
      pointerEvents="box-none"
    >
      <GlassCard padding="sm" radiusToken="xl" strong style={styles.bar}>
        <View style={styles.row}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const descriptor = descriptors[route.key];
            const options = descriptor?.options ?? {};
            const label =
              (options.tabBarLabel as string | undefined) ??
              options.title ??
              route.name;
            const iconName = focused
              ? (ICONS_ACTIVE[route.name] ?? "ellipse")
              : (ICONS[route.name] ?? "ellipse-outline");

            const onPress = () => {
              const event = navigation.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                onPress={onPress}
                style={styles.tab}
                hitSlop={8}
              >
                <Ionicons
                  name={iconName}
                  size={20}
                  color={focused ? palette.accent : palette.inkSoft}
                />
                <EditorialText
                  kind="bodySm"
                  color={focused ? palette.accent : palette.inkSoft}
                  style={{ fontWeight: focused ? "600" : "400", marginTop: 2 }}
                >
                  {label}
                </EditorialText>
                <View style={[styles.dot, focused && styles.dotActive]} />
              </Pressable>
            );
          })}
        </View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    ...shadow.floating,
  },
  bar: { borderRadius: radius.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  tab: {
    flex: 1,
    minHeight: touch.min,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xs,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: palette.accent,
    marginTop: 3,
    opacity: 0,
  },
  dotActive: { opacity: 1 },
});
