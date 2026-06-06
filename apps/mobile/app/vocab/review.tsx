import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Vibration,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import LottieView from "lottie-react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import { useQueryClient } from "@tanstack/react-query";
import { useAudioRecorder, RecordingPresets } from "expo-audio";
import { EditorialText, Screen } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";
import { useProfile } from "@/src/features/auth/use-profile";
import {
  useVocabDeck,
  vocabDeckKey,
} from "@/src/features/vocab/use-vocab-deck";
import {
  pronounceVocab,
  setVocabStarred,
  type VocabItem,
} from "@/src/features/vocab/api";
import { configureForRecording } from "@/src/lib/audio-session";
import { playOnce } from "@/src/features/practice/audio-controller";

const MAX_MASTERY = 3;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const VICTORY_SOUND = require("../../assets/sounds/victory.mp3");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AVATAR = require("../../assets/avatar.json");

type Direction = "native_to_target" | "target_to_native";
type Outcome = "correct" | "wrong" | "peek";
type Phase = "prompt" | "recording" | "checking" | "result";

export default function VocabReviewScreen() {
  const { starred } = useLocalSearchParams<{ starred?: string }>();
  const starredOnly = starred === "1";
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const targetLang = profile?.target_lang ?? "en";
  const nativeLang = profile?.native_lang ?? "en";
  const { data } = useVocabDeck(targetLang, starredOnly);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // Snapshot the queue once on first load so server-side mastery updates don't
  // reshuffle it mid-game.
  const [queue, setQueue] = useState<VocabItem[] | null>(null);
  useEffect(() => {
    if (queue || !data) return;
    const due = data.items.filter((i) => i.mastery < MAX_MASTERY);
    setQueue(due.length > 0 ? due : data.items);
  }, [data, queue]);

  // Refresh the deck (Home count, mastery) when leaving the game.
  useEffect(() => {
    return () => {
      void qc.invalidateQueries({ queryKey: vocabDeckKey(targetLang) });
    };
  }, [qc, targetLang]);

  const [direction, setDirection] = useState<Direction>("native_to_target");
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("prompt");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);

  const spin = useSharedValue(0);
  const progress = useSharedValue(0);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${spin.value}deg` }],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 1000 }, { rotateY: `${spin.value + 180}deg` }],
  }));
  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    };
  }, []);

  if (!queue) {
    return (
      <Screen variant="gradient">
        <View style={styles.center}>
          <ActivityIndicator color={palette.accent} />
        </View>
      </Screen>
    );
  }

  if (queue.length === 0) {
    return (
      <Screen variant="gradient">
        <View style={styles.center}>
          <EditorialText kind="bodyMd" color={palette.inkSoft}>
            Nothing to review yet.
          </EditorialText>
          <Pressable style={styles.smallBtn} onPress={() => router.back()}>
            <EditorialText kind="bodyMd" color={palette.peach}>
              Back
            </EditorialText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (finished) {
    const correctCount = results.filter(Boolean).length;
    const perfect = correctCount === queue.length;
    return (
      <Finish
        perfect={perfect}
        correctCount={correctCount}
        total={queue.length}
      />
    );
  }

  const card = queue[index]!;
  const promptText =
    direction === "native_to_target"
      ? (card.translation ?? card.term)
      : card.term;
  const dirLabel =
    direction === "native_to_target"
      ? `${nativeLang.toUpperCase()} → ${targetLang.toUpperCase()}`
      : `${targetLang.toUpperCase()} → ${nativeLang.toUpperCase()}`;

  function reveal(next: Outcome) {
    setOutcome(next);
    setResults((r) => {
      const copy = [...r];
      copy[index] = next === "correct";
      return copy;
    });
    setPhase("result");
    spin.value = withTiming(180, { duration: 450 });
    if (next === "wrong") Vibration.vibrate(120);
    if (next === "correct") {
      void playOnce({ source: VICTORY_SOUND, durationMs: 900 });
      advanceTimer.current = setTimeout(advance, 1600);
    }
  }

  async function onMicPress() {
    if (phase === "checking") return;
    if (phase === "recording") {
      setPhase("checking");
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) throw new Error("no audio");
        const res = await pronounceVocab(card.id, uri);
        reveal(res.correct ? "correct" : "wrong");
      } catch {
        reveal("wrong");
      }
      return;
    }
    // start recording
    try {
      await configureForRecording();
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase("recording");
    } catch {
      // Mic unavailable / denied — let them peek instead.
      reveal("peek");
    }
  }

  function peek() {
    if (phase !== "prompt") return;
    reveal("peek");
  }

  function advance() {
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
    const isLast = index >= queue!.length - 1;
    if (isLast) {
      setFinished(true);
      return;
    }
    spin.value = 0; // snap back to front for the next card
    progress.value = withTiming((index + 1) / queue!.length, { duration: 300 });
    setIndex((i) => i + 1);
    setOutcome(null);
    setPhase("prompt");
  }

  return (
    <Screen variant="gradient">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <EditorialText kind="bodyMd" color={palette.inkSoft}>
            ‹ Back
          </EditorialText>
        </Pressable>
        <Pressable
          onPress={() =>
            setDirection((d) =>
              d === "native_to_target"
                ? "target_to_native"
                : "native_to_target",
            )
          }
          hitSlop={10}
          style={styles.dirToggle}
        >
          <Ionicons name="swap-horizontal" size={16} color={palette.peach} />
          <EditorialText kind="bodySm" color={palette.peach}>
            {dirLabel}
          </EditorialText>
        </Pressable>
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressStyle]} />
        </View>
        <EditorialText kind="bodySm" color={palette.inkSoft}>
          {index + 1} / {queue.length}
        </EditorialText>
      </View>

      <View style={styles.cardArea}>
        {/* Front face — the prompt */}
        <Animated.View style={[styles.card, styles.cardFace, frontStyle]}>
          <StarButton item={card} language={targetLang} qc={qc} />
          <EditorialText
            kind="displayMd"
            align="center"
            color={palette.ink}
            style={styles.word}
          >
            {promptText}
          </EditorialText>
          <EditorialText
            kind="bodySm"
            align="center"
            color={palette.inkSoft}
            style={styles.hint}
          >
            {direction === "native_to_target"
              ? `Say it in ${targetLang.toUpperCase()}`
              : "Pronounce this word"}
          </EditorialText>
          <Pressable onPress={peek} hitSlop={8} style={styles.peek}>
            <EditorialText kind="bodySm" color={palette.inkSoft}>
              Show answer
            </EditorialText>
          </Pressable>
        </Animated.View>

        {/* Back face — the answer + verdict */}
        <Animated.View
          style={[styles.card, styles.cardFace, styles.cardBack, backStyle]}
          pointerEvents={phase === "result" ? "auto" : "none"}
        >
          {outcome ? (
            <Ionicons
              name={outcome === "correct" ? "checkmark-circle" : "close-circle"}
              size={56}
              color={outcome === "correct" ? "#3CA65A" : palette.coral}
            />
          ) : null}
          <EditorialText
            kind="displayMd"
            align="center"
            color={palette.ink}
            style={styles.word}
          >
            {card.term}
          </EditorialText>
          {card.translation ? (
            <EditorialText kind="bodyMd" align="center" color={palette.inkSoft}>
              {card.translation}
            </EditorialText>
          ) : null}
          <Pressable style={styles.nextBtn} onPress={advance}>
            <EditorialText kind="bodyMd" color={palette.peach}>
              {index >= queue.length - 1 ? "Finish" : "Next ›"}
            </EditorialText>
          </Pressable>
        </Animated.View>
      </View>

      {phase !== "result" ? (
        <View style={styles.micBar}>
          <Pressable
            onPress={onMicPress}
            style={[
              styles.micBtn,
              phase === "recording" && styles.micBtnRecording,
            ]}
          >
            {phase === "checking" ? (
              <ActivityIndicator color={palette.peach} />
            ) : (
              <Ionicons
                name={phase === "recording" ? "stop" : "mic"}
                size={30}
                color={palette.peach}
              />
            )}
          </Pressable>
          <EditorialText kind="bodySm" color={palette.inkSoft}>
            {phase === "recording"
              ? "Listening… tap to stop"
              : phase === "checking"
                ? "Checking…"
                : "Tap and say the word"}
          </EditorialText>
        </View>
      ) : (
        <View style={styles.micBar} />
      )}
    </Screen>
  );
}

function StarButton({
  item,
  language,
  qc,
}: {
  item: VocabItem;
  language: string;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [starred, setStarred] = useState(item.starred);
  return (
    <Pressable
      style={styles.star}
      hitSlop={10}
      onPress={async () => {
        const next = !starred;
        setStarred(next);
        try {
          await setVocabStarred(item.id, next);
          void qc.invalidateQueries({ queryKey: vocabDeckKey(language) });
        } catch {
          setStarred(!next);
        }
      }}
    >
      <Ionicons
        name={starred ? "star" : "star-outline"}
        size={24}
        color={starred ? palette.coral : palette.inkSoft}
      />
    </Pressable>
  );
}

function Finish({
  perfect,
  correctCount,
  total,
}: {
  perfect: boolean;
  correctCount: number;
  total: number;
}) {
  const confettiRef = useRef<ConfettiCannon>(null);
  useEffect(() => {
    if (!perfect) return;
    void playOnce({ source: VICTORY_SOUND });
    confettiRef.current?.start();
  }, [perfect]);

  return (
    <Screen variant="gradient" edgeToEdge>
      <View style={styles.center}>
        {perfect ? (
          <LottieView
            source={AVATAR}
            autoPlay
            loop={false}
            style={styles.avatar}
          />
        ) : null}
        <EditorialText
          kind="displayXl"
          italic
          align="center"
          color={palette.ink}
        >
          {perfect ? "✿ Perfect!" : "Nice work"}
        </EditorialText>
        <EditorialText kind="bodyLg" align="center" color={palette.inkSoft}>
          {correctCount} / {total} correct
        </EditorialText>
        {!perfect ? (
          <EditorialText
            kind="bodySm"
            align="center"
            color={palette.inkSoft}
            style={{ marginTop: spacing.sm, paddingHorizontal: spacing.xl }}
          >
            Get them all right in one run for the celebration.
          </EditorialText>
        ) : null}
        <Pressable
          style={styles.smallBtn}
          onPress={() => router.replace("/vocab")}
        >
          <EditorialText kind="bodyMd" color={palette.peach}>
            Done
          </EditorialText>
        </Pressable>
      </View>
      {perfect ? (
        <ConfettiCannon
          ref={confettiRef}
          count={140}
          origin={{ x: -10, y: 0 }}
          autoStart={false}
          fadeOut
          colors={[palette.accent, palette.coral, palette.peach]}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  dirToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: palette.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  progressWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.glassStrong,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.accent,
  },
  cardArea: {
    flex: 1,
    margin: spacing.xl,
  },
  card: {
    borderRadius: radius.xl,
    backgroundColor: palette.cream,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
    ...shadow.cta,
  },
  cardFace: {
    ...StyleSheet.absoluteFillObject,
    backfaceVisibility: "hidden",
  },
  cardBack: {
    backgroundColor: palette.peach,
  },
  word: { paddingHorizontal: spacing.md },
  hint: { marginTop: spacing.md, opacity: 0.8 },
  peek: { marginTop: spacing.lg, padding: spacing.sm },
  star: { position: "absolute", top: spacing.lg, left: spacing.lg },
  nextBtn: {
    marginTop: spacing.lg,
    backgroundColor: palette.ink,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  micBar: {
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing["2xl"],
    minHeight: 110,
    justifyContent: "center",
  },
  micBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: palette.ink,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.cta,
  },
  micBtnRecording: { backgroundColor: palette.coral },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  avatar: { width: 160, height: 160 },
  smallBtn: {
    marginTop: spacing.lg,
    backgroundColor: palette.ink,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
});
