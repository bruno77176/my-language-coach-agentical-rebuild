export type Language = {
  code: string; // ISO 639-1
  englishName: string;
  nativeName: string;
  flag: string; // emoji
};

export const LANGUAGES: ReadonlyArray<Language> = [
  { code: "en", englishName: "English", nativeName: "English", flag: "🇬🇧" },
  { code: "fr", englishName: "French", nativeName: "Français", flag: "🇫🇷" },
  { code: "de", englishName: "German", nativeName: "Deutsch", flag: "🇩🇪" },
  { code: "it", englishName: "Italian", nativeName: "Italiano", flag: "🇮🇹" },
  { code: "es", englishName: "Spanish", nativeName: "Español", flag: "🇪🇸" },
  {
    code: "pt",
    englishName: "Portuguese",
    nativeName: "Português",
    flag: "🇵🇹",
  },
  { code: "tr", englishName: "Turkish", nativeName: "Türkçe", flag: "🇹🇷" },
  { code: "sv", englishName: "Swedish", nativeName: "Svenska", flag: "🇸🇪" },
  { code: "da", englishName: "Danish", nativeName: "Dansk", flag: "🇩🇰" },
  { code: "ru", englishName: "Russian", nativeName: "Русский", flag: "🇷🇺" },
  { code: "ro", englishName: "Romanian", nativeName: "Română", flag: "🇷🇴" },
  { code: "hu", englishName: "Hungarian", nativeName: "Magyar", flag: "🇭🇺" },
];

export type SupportedLang =
  | "en" | "fr" | "de" | "it" | "es" | "pt"
  | "tr" | "sv" | "da" | "ru" | "ro" | "hu";

export const SUPPORTED_LANG_CODES: readonly SupportedLang[] = [
  "en", "fr", "de", "it", "es", "pt", "tr", "sv", "da", "ru", "ro", "hu",
];
