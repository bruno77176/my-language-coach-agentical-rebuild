import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { EditorialText, Screen } from "@/src/design";
import {
  palette,
  radius,
  shadow,
  spacing,
} from "@language-coach/design-tokens";
import { useSessionFeedback } from "@/src/features/practice/use-session-feedback";
import type { Correction } from "@language-coach/shared";
import { buildFeedbackText } from "@/src/features/sharing/share-text";
import { ShareCardModal } from "@/src/features/sharing/share-card-modal";
import { FeedbackShareCard } from "@/src/features/sharing/share-cards";

export default function EndOfSessionScreen() {
  const { conversationId, checkpointId, secondsSpoken } = useLocalSearchParams<{
    conversationId?: string;
    // Set when viewing a continuous-thread segment's feedback (keyed on the
    // checkpoint); otherwise feedback is keyed on the conversation.
    checkpointId?: string;
    secondsSpoken?: string;
  }>();
  const { data } = useSessionFeedback(
    checkpointId ?? conversationId ?? null,
    checkpointId ? "checkpoint" : "session",
  );
  const [shareOpen, setShareOpen] = useState(false);

  const goHome = () => router.replace("/(tabs)/home");
  const again = () => router.replace("/(tabs)/practice");

  const seconds = secondsSpoken ? Number(secondsSpoken) : 0;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;

  return (
    <Screen variant="gradient">
      <ScrollView contentContainerStyle={styles.scroll}>
        <EditorialText kind="displayMd" italic style={styles.title}>
          Great job!
        </EditorialText>
        <EditorialText
          kind="bodyMd"
          color={palette.inkSoft}
          style={styles.subtitle}
        >
          You spoke for {min} min {sec} sec
        </EditorialText>

        {(!data || data.status === "pending" || data.status === "missing") && (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.accent} />
            <EditorialText kind="bodyMd" color={palette.inkSoft}>
              Your coach is preparing feedback…
            </EditorialText>
          </View>
        )}

        {data?.status === "failed" && (
          <EditorialText
            kind="bodyMd"
            color={palette.inkSoft}
            style={styles.failed}
          >
            Couldn't generate feedback this session. No worries — try another
            conversation.
          </EditorialText>
        )}

        {data?.status === "ready" && (
          <>
            <Section title="✨ Highlights">
              {data.highlights.length === 0 ? (
                <EditorialText kind="bodySm" color={palette.inkSoft}>
                  Plenty more next time.
                </EditorialText>
              ) : (
                data.highlights.map((h, i) => (
                  <Item key={i} top={h.phrase} bottom={h.why} />
                ))
              )}
            </Section>
            <Section title="📝 Things to polish">
              {data.corrections.length === 0 ? (
                <EditorialText kind="bodySm" color={palette.inkSoft}>
                  Nothing to fix — nice.
                </EditorialText>
              ) : (
                data.corrections.map((c, i) => <CorrectionCard key={i} c={c} />)
              )}
            </Section>
            <Section title="📚 Worth remembering">
              {data.vocab.length === 0 ? (
                <EditorialText kind="bodySm" color={palette.inkSoft}>
                  No new vocab today.
                </EditorialText>
              ) : (
                data.vocab.map((v, i) => (
                  <Item
                    key={i}
                    top={`${v.term}  →  ${v.translation}`}
                    bottom={v.source_phrase ?? ""}
                  />
                ))
              )}
            </Section>
            <Pressable
              onPress={() => setShareOpen(true)}
              hitSlop={8}
              style={styles.shareRow}
            >
              <EditorialText kind="bodyMd" color={palette.accent}>
                ✦ Share your progress
              </EditorialText>
            </Pressable>
          </>
        )}

        <View style={styles.actions}>
          <Pressable onPress={again} style={[styles.btn, styles.btnSecondary]}>
            <EditorialText kind="bodyMd" color={palette.inkSoft}>
              Try another
            </EditorialText>
          </Pressable>
          <Pressable onPress={goHome} style={[styles.btn, styles.btnPrimary]}>
            <EditorialText kind="bodyMd" color={palette.peach}>
              Done
            </EditorialText>
          </Pressable>
        </View>
      </ScrollView>
      {data?.status === "ready" && (
        <ShareCardModal
          visible={shareOpen}
          onClose={() => setShareOpen(false)}
          caption={buildFeedbackText({
            durationLabel: `${min} min ${sec} sec`,
            highlights: data.highlights,
            corrections: data.corrections,
            vocab: data.vocab,
          })}
        >
          <FeedbackShareCard
            durationLabel={`${min} min of practice`}
            highlight={data.highlights[0]?.phrase}
          />
        </ShareCardModal>
      )}
    </Screen>
  );
}

// A correction the user can tap to reveal the grammar rule + example (the
// deeper "why"), instead of one flat line. Collapsed by default to keep the
// report skimmable.
function CorrectionCard({ c }: { c: Correction }) {
  const [open, setOpen] = useState(false);
  const hasDetail = Boolean(c.rule || c.example || c.explanation);
  return (
    <Pressable
      onPress={() => hasDetail && setOpen((v) => !v)}
      style={styles.item}
    >
      <EditorialText kind="bodyMd" style={styles.itemTop}>
        You said “{c.you_said}”
      </EditorialText>
      <EditorialText kind="bodySm" color={palette.accent}>
        Better: “{c.better}”
      </EditorialText>
      {!open && hasDetail ? (
        <EditorialText kind="bodySm" color={palette.inkSoft}>
          Tap for the rule ▾
        </EditorialText>
      ) : null}
      {open ? (
        <View style={styles.detail}>
          {c.explanation ? (
            <EditorialText kind="bodySm" color={palette.inkSoft}>
              {c.explanation}
            </EditorialText>
          ) : null}
          {c.rule ? (
            <EditorialText kind="bodySm" color={palette.ink}>
              📘 {c.rule}
            </EditorialText>
          ) : null}
          {c.example ? (
            <EditorialText kind="bodySm" color={palette.inkSoft} italic>
              e.g. {c.example}
            </EditorialText>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <EditorialText kind="bodyMd" style={styles.sectionTitle}>
        {title}
      </EditorialText>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Item({
  top,
  middle,
  bottom,
}: {
  top: string;
  middle?: string;
  bottom?: string;
}) {
  return (
    <View style={styles.item}>
      <EditorialText kind="bodyMd" style={styles.itemTop}>
        {top}
      </EditorialText>
      {middle ? (
        <EditorialText kind="bodySm" color={palette.accent}>
          {middle}
        </EditorialText>
      ) : null}
      {bottom ? (
        <EditorialText kind="bodySm" color={palette.inkSoft}>
          {bottom}
        </EditorialText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, paddingBottom: spacing["3xl"] },
  title: { color: palette.ink },
  subtitle: { marginBottom: spacing.xl },
  loading: { gap: spacing.md, alignItems: "center", marginTop: spacing.xl },
  failed: { marginTop: spacing.xl },
  shareRow: { alignItems: "center", marginTop: spacing.xl },
  section: { marginTop: spacing.xl },
  sectionTitle: {
    fontWeight: "600",
    color: palette.ink,
    marginBottom: spacing.sm,
  },
  sectionBody: { gap: spacing.md },
  item: {
    backgroundColor: palette.glassStrong,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  itemTop: { color: palette.ink },
  detail: { gap: spacing.xs, marginTop: spacing.xs },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing["2xl"],
  },
  btn: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    alignItems: "center",
    ...shadow.cta,
  },
  btnPrimary: { backgroundColor: palette.ink },
  btnSecondary: { backgroundColor: palette.cream },
});
