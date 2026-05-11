import { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import LottieView from "lottie-react-native";
import { FadeInView, Screen } from "@/src/design";
import { motion } from "@language-coach/design-tokens";
import avatarLottie from "../../../assets/avatar.json";

type Props = { onFinish: () => void };

export function IntroScreen({ onFinish }: Props) {
  const lottie = useRef<LottieView>(null);

  useEffect(() => {
    const timer = setTimeout(onFinish, motion.duration.intro);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <Screen variant="gradient">
      <FadeInView style={styles.center} duration={motion.duration.slow}>
        <LottieView
          ref={lottie}
          source={avatarLottie}
          autoPlay
          loop={false}
          style={styles.avatar}
        />
      </FadeInView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatar: { width: 220, height: 220 },
});
