import type { Metadata } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
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

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mylanguagecoach.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "My Language Coach — Practice languages. Build confidence.",
  description:
    "Your AI conversation partner. Talk to it, get instant corrections, and become fluent in any language — anywhere.",
  alternates: {
    canonical: "/",
    languages: {
      en: "/",
      fr: "/fr",
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    title: "My Language Coach",
    description: "Practice languages. Build confidence.",
    url: "/",
    siteName: "My Language Coach",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "My Language Coach",
    description: "Practice languages. Build confidence.",
    images: ["/og-image.png"],
  },
  icons: { icon: "/favicon.ico" },
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
        <Analytics />
      </body>
    </html>
  );
}
