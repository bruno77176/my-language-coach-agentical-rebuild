import type { Metadata } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { LOCALES } from "../lib/i18n";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://mylanguagecoach.app";

// hreflang map for every supported locale. English lives at the root; every
// other locale lives under /<locale>. Generated from LOCALES so new locales
// stay in sync automatically.
const languageAlternates: Record<string, string> = {
  ...Object.fromEntries(
    LOCALES.map((locale) => [locale, locale === "en" ? "/" : `/${locale}`]),
  ),
  "x-default": "/",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "My Language Coach — Practice languages. Build confidence.",
  description:
    "Practice real conversations with an AI coach that remembers you, runs real-life role-plays, and gives feedback after every chat. Build speaking confidence in 15 languages.",
  alternates: {
    canonical: "/",
    languages: languageAlternates,
  },
  openGraph: {
    type: "website",
    title: "My Language Coach",
    description: "Practice languages. Build confidence.",
    url: "/",
    siteName: "My Language Coach",
    images: [{ url: "/og-image.jpg", width: 1024, height: 500 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "My Language Coach",
    description: "Practice languages. Build confidence.",
    images: ["/og-image.jpg"],
  },
  icons: { icon: "/favicon.ico" },
};

// Site-wide structured data. No aggregateRating yet — the product is
// pre-traction, so we don't fabricate review counts or star ratings.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "My Language Coach",
      url: SITE_URL,
      logo: `${SITE_URL}/character.png`,
    },
    {
      "@type": "MobileApplication",
      "@id": `${SITE_URL}/#app`,
      name: "My Language Coach",
      operatingSystem: "iOS, Android",
      applicationCategory: "EducationalApplication",
      description:
        "Practice real conversations with an AI coach that remembers you, runs real-life role-plays, and gives feedback after every chat. Build speaking confidence in 15 languages.",
      inLanguage: [
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
      ],
      offers: [
        { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free" },
        { "@type": "Offer", price: "7.99", priceCurrency: "USD", name: "Pro" },
      ],
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable}`}>
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <Analytics />
      </body>
    </html>
  );
}
