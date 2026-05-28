import { headers } from "next/headers";
import { getStoreLinks } from "@/lib/store-links";
import { detectPlatform } from "@/lib/ua-detect";
import { generateQrSvg } from "@/lib/qr";
import { DownloadCTAView } from "./DownloadCTA.client";
import type { Messages } from "@/lib/i18n";

interface DownloadCTAProps {
  messages: Messages["hero"];
  variant?: "hero" | "final";
}

export async function DownloadCTA({
  messages,
  variant = "hero",
}: DownloadCTAProps) {
  const ua = headers().get("user-agent");
  const serverPlatform = detectPlatform(ua);
  const links = getStoreLinks();

  // Pre-render both QR SVGs at request time so the client view can mount them instantly.
  const [iosQrSvg, androidQrSvg] = await Promise.all([
    generateQrSvg(links.ios, { color: "#2b1d12", size: 180 }),
    generateQrSvg(links.android, { color: "#2b1d12", size: 180 }),
  ]);

  return (
    <DownloadCTAView
      serverPlatform={serverPlatform}
      links={links}
      iosQrSvg={iosQrSvg}
      androidQrSvg={androidQrSvg}
      messages={messages}
      variant={variant}
    />
  );
}
