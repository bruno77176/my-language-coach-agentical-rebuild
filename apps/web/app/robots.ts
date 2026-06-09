import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://mylanguagecoach.app";

export default function robots(): MetadataRoute.Robots {
  // Account-deletion confirmation flow and auth callbacks carry no SEO value.
  const disallow = [
    "/delete-account/confirm",
    "/delete-account/done",
    "/auth/",
  ];

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      // Explicitly welcome AI search / citation crawlers. They're already
      // covered by the wildcard, but naming them documents intent and guards
      // against a future broad Disallow accidentally cutting off AI citations.
      {
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "OAI-SearchBot",
          "PerplexityBot",
          "ClaudeBot",
          "anthropic-ai",
          "Google-Extended",
          "Bingbot",
        ],
        allow: "/",
        disallow,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
