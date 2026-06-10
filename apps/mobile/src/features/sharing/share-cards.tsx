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

// Fixed width → consistent captured image size.
const CARD_WIDTH = 360;

/**
 * Branded poster frame. The card is the *visual* of a share; the full content +
 * the tappable link travel in the share's text caption (see share-text.ts), so
 * the recipient gets a pretty image AND a clickable invite — the Duolingo model.
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
        <EditorialText kind="bodyMd" italic style={styles.brand}>
          My Language Coach
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

export function ConversationShareCard({
  languageName,
  durationMinutes,
}: {
  languageName: string;
  durationMinutes: number;
}) {
  return (
    <CardFrame>
      <EditorialText kind="displayXl" italic style={styles.big}>
        {durationMinutes} min
      </EditorialText>
      <EditorialText kind="bodyLg" color={palette.ink} style={styles.sub}>
        of {languageName} conversation 🗣️
      </EditorialText>
    </CardFrame>
  );
}

export function FeedbackShareCard({
  durationLabel,
  highlight,
}: {
  durationLabel: string;
  highlight?: string;
}) {
  return (
    <CardFrame>
      <EditorialText kind="displayXl" italic style={styles.big}>
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
    </CardFrame>
  );
}

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH, borderRadius: radius.xl, padding: spacing.xl },
  label: { letterSpacing: 1.5, marginBottom: spacing.sm },
  quote: { color: palette.ink },
  attr: { marginTop: spacing.md },
  big: { color: palette.ink },
  sub: { marginTop: spacing.xs },
  block: { marginTop: spacing.lg },
  footer: {
    marginTop: spacing.xl,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: { color: palette.ink },
});
