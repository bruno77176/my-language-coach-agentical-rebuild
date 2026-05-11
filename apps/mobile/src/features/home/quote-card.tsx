import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { DailyQuote, SupportedLang } from "@language-coach/shared";
import { palette, spacing } from "@language-coach/design-tokens";
import { EditorialText, GlassCard } from "@/src/design";

type Props = {
  quote: DailyQuote;
  nativeLang: SupportedLang;
};

export function QuoteCard({ quote, nativeLang }: Props) {
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
  attribution: { marginTop: spacing.md },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(0,0,0,0.12)",
    marginVertical: spacing.md,
  },
  hint: { marginTop: spacing.md },
});
