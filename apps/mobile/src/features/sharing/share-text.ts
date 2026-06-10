import type { DailyQuote, SupportedLang } from "@language-coach/shared";

// Marketing site — every share ends with this so the recipient gets a real,
// tappable link to the app (an image can't be tapped; text URLs auto-linkify).
export const APP_URL = "https://www.mylanguagecoach.app";

/** Quote + native-language translation + attribution + tappable app link. */
export function buildQuoteText(
  quote: DailyQuote,
  nativeLang: SupportedLang,
): string {
  const lines: string[] = [
    `“${quote.original.text}”`,
    `— ${quote.attribution} ${quote.original.flag}`,
  ];
  const translation = quote.translations[nativeLang];
  if (translation && quote.original.lang !== nativeLang) {
    lines.push("", translation);
  }
  lines.push(
    "",
    "✦ Quote of the day from My Language Coach",
    `Learn a language with Lisa → ${APP_URL}`,
  );
  return lines.join("\n");
}

export type FeedbackTextInput = {
  durationLabel: string;
  highlights: { phrase: string; why: string }[];
  corrections: { you_said: string; better: string; explanation: string }[];
  vocab: { term: string; translation: string; source_phrase?: string | null }[];
};

/** Full end-of-session feedback as text (all sections) + tappable app link. */
export function buildFeedbackText(input: FeedbackTextInput): string {
  const lines: string[] = [
    `My Language Coach — session feedback (${input.durationLabel})`,
    "",
  ];
  if (input.highlights.length) {
    lines.push("✨ Highlights");
    for (const h of input.highlights) {
      lines.push(`• ${h.phrase}${h.why ? ` — ${h.why}` : ""}`);
    }
    lines.push("");
  }
  if (input.corrections.length) {
    lines.push("📝 Things to polish");
    for (const c of input.corrections) {
      lines.push(
        `• You said “${c.you_said}” → “${c.better}”${
          c.explanation ? ` (${c.explanation})` : ""
        }`,
      );
    }
    lines.push("");
  }
  if (input.vocab.length) {
    lines.push("📚 Worth remembering");
    for (const v of input.vocab) {
      lines.push(`• ${v.term} → ${v.translation}`);
    }
    lines.push("");
  }
  lines.push(`Practice with me → ${APP_URL}`);
  return lines.join("\n");
}
