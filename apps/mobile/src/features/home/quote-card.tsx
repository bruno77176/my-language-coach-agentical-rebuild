import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { DailyQuote, SupportedLang } from "@language-coach/shared";

type Props = {
  quote: DailyQuote;
  nativeLang: SupportedLang;
};

export function QuoteCard({ quote, nativeLang }: Props) {
  const [showTranslation, setShowTranslation] = useState(false);
  const translation = quote.translations[nativeLang];
  const showsTranslation = showTranslation && quote.original.lang !== nativeLang;

  return (
    <Pressable
      testID="quote-card"
      onPress={() => setShowTranslation((s) => !s)}
      style={styles.card}
    >
      <Text style={styles.original}>"{quote.original.text}"</Text>
      <Text style={styles.attribution}>
        — {quote.attribution} {quote.original.flag}
      </Text>
      {showsTranslation ? (
        <>
          <View style={styles.divider} />
          <Text style={styles.translation}>{translation}</Text>
          <Text style={styles.hint}>▲ hide translation</Text>
        </>
      ) : quote.original.lang !== nativeLang ? (
        <Text style={styles.hint}>▽ tap for translation</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 20,
    width: "100%",
  },
  original: {
    fontSize: 18,
    fontStyle: "italic",
    color: "#111827",
    lineHeight: 26,
    marginBottom: 12,
  },
  attribution: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "right",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#d1d5db",
    marginVertical: 12,
  },
  translation: {
    fontSize: 15,
    color: "#4b5563",
    lineHeight: 22,
  },
  hint: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 12,
    textAlign: "center",
  },
});
