import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { DailyQuote } from "@language-coach/shared";
import {
  gradients,
  palette,
  radius,
  spacing,
} from "@language-coach/design-tokens";
import { EditorialText } from "@/src/design";

// Fixed width so every captured image is a consistent, predictable size.
const CARD_WIDTH = 340;

/**
 * Branded frame for all share cards — Sunrise gradient + a footer that carries
 * the app + marketing URL into the image (so every share is a way to get the
 * app, per the sharing brief). Captured to PNG by ShareCardModal.
 */
function CardFrame({ children }: { children: ReactNode }) {
  return (
    <LinearGradient
      colors={[...gradients.sunrise] as [string, string, string]}
      locations={[0, 0.5, 1]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.card}
    >
      <View>{children}</View>
      <View style={styles.footer}>
        <EditorialText kind="bodySm" style={styles.brand}>
          ✦ My Language Coach
        </EditorialText>
        <EditorialText kind="bodySm" color={palette.inkSoft}>
          mylanguagecoach.app
        </EditorialText>
      </View>
    </LinearGradient>
  );
}

export function QuoteShareCard({ quote }: { quote: DailyQuote }) {
  return (
    <CardFrame>
      <EditorialText kind="bodySm" color={palette.inkSoft} style={styles.label}>
        ✦ QUOTE OF THE DAY
      </EditorialText>
      <EditorialText kind="displayMd" italic style={styles.quote}>
        {`“${quote.original.text}”`}
      </EditorialText>
      <EditorialText
        kind="bodySm"
        color={palette.inkSoft}
        align="right"
        style={styles.attr}
      >
        — {quote.attribution} {quote.original.flag}
      </EditorialText>
    </CardFrame>
  );
}

export type ShareLine = { role: "user" | "coach"; text: string };

export function ConversationShareCard({
  languageName,
  durationMinutes,
  lines,
}: {
  languageName: string;
  durationMinutes: number;
  lines: ShareLine[];
}) {
  return (
    <CardFrame>
      <EditorialText kind="bodySm" color={palette.inkSoft} style={styles.label}>
        {languageName.toUpperCase()} PRACTICE · {durationMinutes} MIN
      </EditorialText>
      <View style={styles.lines}>
        {lines.map((l, i) => (
          <View key={i} style={styles.line}>
            <EditorialText
              kind="bodySm"
              color={l.role === "user" ? palette.accent : palette.inkSoft}
              style={styles.speaker}
            >
              {l.role === "user" ? "You" : "Coach"}
            </EditorialText>
            <EditorialText kind="bodyMd" color={palette.ink}>
              {l.text}
            </EditorialText>
          </View>
        ))}
      </View>
    </CardFrame>
  );
}

export function FeedbackShareCard({
  durationLabel,
  highlight,
  vocab,
}: {
  durationLabel: string;
  highlight?: string;
  vocab?: { term: string; translation: string };
}) {
  return (
    <CardFrame>
      <EditorialText kind="displayMd" italic style={styles.quote}>
        {durationLabel} ✨
      </EditorialText>
      {highlight ? (
        <View style={styles.block}>
          <EditorialText
            kind="bodySm"
            color={palette.inkSoft}
            style={styles.label}
          >
            ✨ HIGHLIGHT
          </EditorialText>
          <EditorialText kind="bodyMd" color={palette.ink}>
            {highlight}
          </EditorialText>
        </View>
      ) : null}
      {vocab ? (
        <View style={styles.block}>
          <EditorialText
            kind="bodySm"
            color={palette.inkSoft}
            style={styles.label}
          >
            📚 NEW WORD
          </EditorialText>
          <EditorialText kind="bodyMd" color={palette.ink}>
            {vocab.term} → {vocab.translation}
          </EditorialText>
        </View>
      ) : null}
    </CardFrame>
  );
}

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH, borderRadius: radius.xl, padding: spacing.xl },
  label: { letterSpacing: 1.5, marginBottom: spacing.sm },
  quote: { color: palette.ink },
  attr: { marginTop: spacing.md },
  lines: { gap: spacing.md },
  line: { gap: 2 },
  speaker: { letterSpacing: 0.5 },
  block: { marginTop: spacing.lg },
  footer: {
    marginTop: spacing.xl,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: { color: palette.ink, fontWeight: "600" },
});
