import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DailyQuote, SupportedLang } from "@language-coach/shared";
import { palette, spacing } from "@language-coach/design-tokens";
import { EditorialText, GlassCard } from "@/src/design";

type Props = {
  quote: DailyQuote;
  nativeLang: SupportedLang;
  /** When provided, a small share icon shows in the card's top-right. */
  onShare?: () => void;
  /** Whether the user has liked this quote (BRU-9). */
  liked?: boolean;
  /** When provided, a heart toggle shows next to share. */
  onToggleLike?: () => void;
};

export function QuoteCard({
  quote,
  nativeLang,
  onShare,
  liked,
  onToggleLike,
}: Props) {
  const [showTranslation, setShowTranslation] = useState(false);
  const translation = quote.translations[nativeLang];
  const showsTranslation =
    showTranslation && quote.original.lang !== nativeLang;

  return (
    <Pressable
      testID="quote-card"
      onPress={() => setShowTranslation((s) => !s)}
    >
      <GlassCard padding="lg" radiusToken="lg">
        <View style={styles.labelRow}>
          <EditorialText
            kind="bodySm"
            color={palette.inkSoft}
            style={styles.label}
          >
            ✦ Quote of the day
          </EditorialText>
          <View style={styles.actions}>
            {onToggleLike ? (
              <Pressable
                onPress={onToggleLike}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={liked ? "Unlike quote" : "Like quote"}
              >
                <Ionicons
                  name={liked ? "heart" : "heart-outline"}
                  size={17}
                  color={liked ? palette.coral : palette.inkSoft}
                />
              </Pressable>
            ) : null}
            {onShare ? (
              <Pressable
                onPress={onShare}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Share quote"
              >
                <Ionicons
                  name="share-social-outline"
                  size={16}
                  color={palette.inkSoft}
                />
              </Pressable>
            ) : null}
          </View>
        </View>
        <EditorialText kind="displayMd" italic>
          &ldquo;{quote.original.text}&rdquo;
        </EditorialText>
        <EditorialText
          kind="bodySm"
          color={palette.inkSoft}
          align="right"
          style={styles.attribution}
        >
          — {quote.attribution} {quote.original.flag}
        </EditorialText>
        {showsTranslation ? (
          <>
            <View style={styles.divider} />
            <EditorialText kind="bodyMd" color={palette.inkSoft}>
              {translation}
            </EditorialText>
            <EditorialText
              kind="bodySm"
              color={palette.inkSoft}
              align="center"
              style={styles.hint}
            >
              ▲ hide translation
            </EditorialText>
          </>
        ) : quote.original.lang !== nativeLang ? (
          <EditorialText
            kind="bodySm"
            color={palette.inkSoft}
            align="center"
            style={styles.hint}
          >
            ▽ tap for translation
          </EditorialText>
        ) : null}
      </GlassCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  label: { letterSpacing: 1.5 },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.base },
  attribution: { marginTop: spacing.md },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.12)",
    marginVertical: spacing.md,
  },
  hint: { marginTop: spacing.md },
});
