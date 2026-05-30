import type { ReactNode } from "react";
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

export default function EndOfSessionScreen() {
  const { conversationId, secondsSpoken } = useLocalSearchParams<{
    conversationId: string;
    secondsSpoken?: string;
  }>();
  const { data } = useSessionFeedback(conversationId ?? null);

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

        {(!data || data.status === "pending") && (
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
            <Section title="✨ What you nailed">
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
                data.corrections.map((c, i) => (
                  <Item
                    key={i}
                    top={`You said "${c.you_said}"`}
                    middle={`Better: "${c.better}"`}
                    bottom={c.explanation}
                  />
                ))
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
    </Screen>
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
  btnSecondary: { backgroundColor: palette.glassStrong },
});
