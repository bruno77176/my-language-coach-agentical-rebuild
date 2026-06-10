import { useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import LottieView from "lottie-react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import { EditorialText, FadeInView, Screen } from "@/src/design";
import { palette, spacing } from "@language-coach/design-tokens";
import avatarLottie from "../../../assets/avatar.json";

type Props = {
  visible: boolean;
  onHidden: () => void;
};

/**
 * Full-screen celebration shown after a successful purchase — replaces the
 * stock grey Alert. Mirrors the GoalReward pattern (gradient Screen + confetti
 * + the coach avatar) so the Pro upgrade feels like a moment, on-brand with
 * the rest of the app. Tap anywhere or wait ~3.5s to dismiss.
 */
export function PaywallSuccess({ visible, onHidden }: Props) {
  const confettiRef = useRef<ConfettiCannon>(null);

  useEffect(() => {
    if (!visible) return;
    confettiRef.current?.start();
    const t = setTimeout(onHidden, 3500);
    return () => clearTimeout(t);
  }, [visible, onHidden]);

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <Screen variant="gradient" edgeToEdge>
        <Pressable style={styles.overlay} onPress={onHidden}>
          <FadeInView style={styles.content}>
            <LottieView
              source={avatarLottie}
              autoPlay
              loop={false}
              style={styles.avatar}
            />
            <EditorialText
              kind="displayXl"
              italic
              align="center"
              style={styles.title}
            >
              {"✦ Welcome to Pro"}
            </EditorialText>
            <EditorialText
              kind="bodyLg"
              color={palette.inkSoft}
              align="center"
              style={styles.subtitle}
            >
              {"Everything's unlocked. Let's get to work."}
            </EditorialText>
          </FadeInView>
        </Pressable>
        <ConfettiCannon
          ref={confettiRef}
          count={120}
          origin={{ x: -10, y: 0 }}
          autoStart={false}
          fadeOut
          colors={[palette.accent, palette.coral, palette.peach, palette.mauve]}
        />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { alignItems: "center", padding: spacing.xl },
  avatar: { width: 200, height: 200 },
  title: { marginTop: spacing.md },
  subtitle: { marginTop: spacing.sm, paddingHorizontal: spacing.xl },
});
