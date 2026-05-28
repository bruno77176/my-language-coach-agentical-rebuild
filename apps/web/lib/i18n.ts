import en from "../messages/en.json";
import fr from "../messages/fr.json";

export type Locale = "en" | "fr";
export const LOCALES: readonly Locale[] = ["en", "fr"] as const;
export const DEFAULT_LOCALE: Locale = "en";

export type Messages = typeof en;

const dictionaries: Record<Locale, Messages> = {
  en,
  fr: fr as Messages,
};

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export function otherLocale(locale: Locale): Locale {
  return locale === "en" ? "fr" : "en";
}

// Maps an EN-rooted path to the equivalent path in the target locale.
// "/" + en → "/", "/" + fr → "/fr", "/privacy" + fr → "/fr/privacy".
export function localizedPath(pathname: string, locale: Locale): string {
  const stripped = pathname.replace(/^\/fr(?=\/|$)/, "") || "/";
  if (locale === "en") return stripped;
  return stripped === "/" ? "/fr" : `/fr${stripped}`;
}
