import type { MetadataRoute } from "next";
import { LOCALES, DEFAULT_LOCALE } from "../lib/i18n";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://mylanguagecoach.app";

const abs = (path: string) => (path === "/" ? SITE_URL : `${SITE_URL}${path}`);

// hreflang set for the home page across all 15 locales (self-referencing +
// reciprocal + x-default), as required for the cluster to be honored.
function homeLanguages(): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) {
    languages[locale] =
      locale === DEFAULT_LOCALE ? abs("/") : abs(`/${locale}`);
  }
  languages["x-default"] = abs("/");
  return languages;
}

// hreflang set for pages that only exist in English + French (legal pages).
function enFrLanguages(enPath: string, frPath: string): Record<string, string> {
  return { en: abs(enPath), fr: abs(frPath), "x-default": abs(enPath) };
}

export default function sitemap(): MetadataRoute.Sitemap {
  const homeLangs = homeLanguages();

  const home: MetadataRoute.Sitemap[number] = {
    url: abs("/"),
    changeFrequency: "weekly",
    priority: 1,
    alternates: { languages: homeLangs },
  };

  const localeHomes: MetadataRoute.Sitemap = LOCALES.filter(
    (l) => l !== DEFAULT_LOCALE,
  ).map((locale) => ({
    url: abs(`/${locale}`),
    changeFrequency: "weekly",
    priority: 0.8,
    alternates: { languages: homeLangs },
  }));

  const legalPair = (enPath: string, frPath: string): MetadataRoute.Sitemap => {
    const languages = enFrLanguages(enPath, frPath);
    return [enPath, frPath].map((p) => ({
      url: abs(p),
      changeFrequency: "yearly",
      priority: 0.3,
      alternates: { languages },
    }));
  };

  return [
    home,
    ...localeHomes,
    ...legalPair("/privacy", "/fr/privacy"),
    ...legalPair("/terms", "/fr/terms"),
  ];
}
