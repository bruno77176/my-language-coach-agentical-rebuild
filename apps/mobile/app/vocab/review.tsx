import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { EditorialText, Screen } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";
import { useProfile } from "@/src/features/auth/use-profile";
import { useVocabDeck } from "@/src/features/vocab/use-vocab-deck";
import { useReviewVocab } from "@/src/features/vocab/use-vocab-mutations";
import type { ReviewResult, VocabItem } from "@/src/features/vocab/api";

const MAX_MASTERY = 3;

export default function VocabReviewScreen() {
  const { data: profile } = useProfile();
  const language = profile?.target_lang ?? "en";
  const { data } = useVocabDeck(language);
  const review = useReviewVocab(language);

  // Snapshot the queue once, the first time the deck loads, so query
  // invalidations from recording results don't reshuffle it mid-review.
  const [queue, setQueue] = useState<VocabItem[] | null>(null);
  useEffect(() => {
    if (queue || !data) return;
    const due = data.items.filter((i) => i.mastery < MAX_MASTERY);
    setQueue(due.length > 0 ? due : data.items);
  }, [data, queue]);

  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [gotItCount, setGotItCount] = useState(0);

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

  if (index >= queue.length) {
    return (
      <Screen variant="gradient">
        <View style={styles.center}>
          <EditorialText kind="displayMd" italic color={palette.ink}>
            Deck complete!
          </EditorialText>
          <EditorialText kind="bodyMd" color={palette.inkSoft}>
            {gotItCount} of {queue.length} marked “Got it”.
          </EditorialText>
          <Pressable
            style={styles.smallBtn}
            onPress={() => router.replace("/vocab")}
          >
            <EditorialText kind="bodyMd" color={palette.peach}>
              Done
            </EditorialText>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const card = queue[index]!;

  function record(result: ReviewResult) {
    review.mutate({ id: card.id, result });
    if (result === "got_it") setGotItCount((n) => n + 1);
    setFlipped(false);
    setIndex((i) => i + 1);
  }

  return (
    <Screen variant="gradient">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <EditorialText kind="bodyMd" color={palette.inkSoft}>
            ‹ Back
          </EditorialText>
        </Pressable>
        <EditorialText kind="bodySm" color={palette.inkSoft}>
          {index + 1} / {queue.length}
        </EditorialText>
      </View>

      <Pressable style={styles.card} onPress={() => setFlipped((f) => !f)}>
        <EditorialText kind="displayMd" align="center" color={palette.ink}>
          {card.term}
        </EditorialText>
        {flipped ? (
          <>
            <View style={styles.divider} />
            <EditorialText kind="bodyLg" align="center" color={palette.inkSoft}>
              {card.translation ?? "—"}
            </EditorialText>
          </>
        ) : (
          <EditorialText
            kind="bodySm"
            align="center"
            color={palette.inkSoft}
            style={{ marginTop: spacing.lg, opacity: 0.7 }}
          >
            Tap to reveal
          </EditorialText>
        )}
      </Pressable>

      {flipped ? (
        <View style={styles.actions}>
          <Pressable
            style={[styles.btn, styles.btnSecondary]}
            onPress={() => record("still_learning")}
          >
            <EditorialText kind="bodyMd" color={palette.ink}>
              Still learning
            </EditorialText>
          </Pressable>
          <Pressable
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => record("got_it")}
          >
            <EditorialText kind="bodyMd" color={palette.peach}>
              Got it
            </EditorialText>
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  card: {
    flex: 1,
    margin: spacing.xl,
    borderRadius: radius.xl,
    backgroundColor: palette.glassStrong,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    ...shadow.cta,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: palette.inkSoft,
    opacity: 0.2,
    alignSelf: "stretch",
    marginVertical: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  btn: {
    flex: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.base + 2,
    alignItems: "center",
    minHeight: 52,
    ...shadow.cta,
  },
  btnPrimary: { backgroundColor: palette.ink },
  btnSecondary: { backgroundColor: palette.cream },
  smallBtn: {
    marginTop: spacing.lg,
    backgroundColor: palette.ink,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
});
