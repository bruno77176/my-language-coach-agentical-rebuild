import en from "../messages/en.json";
import fr from "../messages/fr.json";
import de from "../messages/de.json";
import it from "../messages/it.json";
import es from "../messages/es.json";
import pt from "../messages/pt.json";
import tr from "../messages/tr.json";
import sv from "../messages/sv.json";
import da from "../messages/da.json";
import ru from "../messages/ru.json";
import ro from "../messages/ro.json";
import hu from "../messages/hu.json";
import ja from "../messages/ja.json";
import zh from "../messages/zh.json";
import ko from "../messages/ko.json";

export type Locale =
  | "en"
  | "fr"
  | "de"
  | "it"
  | "es"
  | "pt"
  | "tr"
  | "sv"
  | "da"
  | "ru"
  | "ro"
  | "hu"
  | "ja"
  | "zh"
  | "ko";
export const LOCALES: readonly Locale[] = [
  "en",
  "fr",
  "de",
  "it",
  "es",
  "pt",
  "tr",
  "sv",
  "da",
  "ru",
  "ro",
  "hu",
  "ja",
  "zh",
  "ko",
] as const;
export const DEFAULT_LOCALE: Locale = "en";

// Display metadata for each locale — shown in the language picker.
export const LOCALE_META: Record<
  Locale,
  { englishName: string; nativeName: string; flag: string }
> = {
  en: { englishName: "English", nativeName: "English", flag: "🇬🇧" },
  fr: { englishName: "French", nativeName: "Français", flag: "🇫🇷" },
  de: { englishName: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  it: { englishName: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
  es: { englishName: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  pt: { englishName: "Portuguese", nativeName: "Português", flag: "🇵🇹" },
  tr: { englishName: "Turkish", nativeName: "Türkçe", flag: "🇹🇷" },
  sv: { englishName: "Swedish", nativeName: "Svenska", flag: "🇸🇪" },
  da: { englishName: "Danish", nativeName: "Dansk", flag: "🇩🇰" },
  ru: { englishName: "Russian", nativeName: "Русский", flag: "🇷🇺" },
  ro: { englishName: "Romanian", nativeName: "Română", flag: "🇷🇴" },
  hu: { englishName: "Hungarian", nativeName: "Magyar", flag: "🇭🇺" },
  ja: { englishName: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  zh: { englishName: "Chinese", nativeName: "中文", flag: "🇨🇳" },
  ko: { englishName: "Korean", nativeName: "한국어", flag: "🇰🇷" },
};

export type Messages = typeof en;

const dictionaries: Record<Locale, Messages> = {
  en,
  fr: fr as Messages,
  de: de as Messages,
  it: it as Messages,
  es: es as Messages,
  pt: pt as Messages,
  tr: tr as Messages,
  sv: sv as Messages,
  da: da as Messages,
  ru: ru as Messages,
  ro: ro as Messages,
  hu: hu as Messages,
  ja: ja as Messages,
  zh: zh as Messages,
  ko: ko as Messages,
};

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

// Maps an EN-rooted path to the equivalent path in the target locale.
// English lives at the root: "/", "/privacy", etc.
// Other locales live under /<locale>/: "/fr", "/fr/privacy", etc.
export function localizedPath(pathname: string, locale: Locale): string {
  // Strip any existing locale prefix.
  const localePrefix = LOCALES.filter((l) => l !== "en").join("|");
  const stripped =
    pathname.replace(new RegExp(`^/(${localePrefix})(?=/|$)`), "") || "/";
  if (locale === "en") return stripped;
  return stripped === "/" ? `/${locale}` : `/${locale}${stripped}`;
}
