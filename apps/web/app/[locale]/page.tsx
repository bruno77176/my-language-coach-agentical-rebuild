import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { LandingPage } from "@/components/LandingPage";
import {
  DEFAULT_LOCALE,
  LOCALES,
  getMessages,
  isLocale,
  type Locale,
} from "@/lib/i18n";

type PageProps = {
  params: Promise<{ locale: string }>;
};

// Pre-generate all non-English locale routes at build time.
export function generateStaticParams() {
  return LOCALES.filter((l) => l !== DEFAULT_LOCALE).map((locale) => ({
    locale,
  }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale) || locale === DEFAULT_LOCALE) {
    return {};
  }
  const m = getMessages(locale as Locale);
  return {
    title: m.meta.title,
    description: m.meta.description,
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries([
        ...LOCALES.map((l) => [l, l === DEFAULT_LOCALE ? "/" : `/${l}`]),
        ["x-default", "/"],
      ]),
    },
  };
}

export default async function LocaleHomePage({ params }: PageProps) {
  const { locale } = await params;
  // English is served from "/" only; reject /en to avoid duplicate content.
  if (!isLocale(locale) || locale === DEFAULT_LOCALE) {
    notFound();
  }
  return <LandingPage locale={locale as Locale} />;
}
