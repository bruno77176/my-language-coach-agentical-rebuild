import { headers } from "next/headers";
import { getStoreLinks } from "@/lib/store-links";
import { detectPlatform, type Platform } from "@/lib/ua-detect";
import { generateQrSvg } from "@/lib/qr";
import { MobileButtonClient } from "./DownloadCTA.client";
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
  const platform = detectPlatform(ua);
  const links = getStoreLinks();

  // Pre-render both QR codes at request time; CSS hides the wrong one per breakpoint.
  const [iosQr, androidQr] = await Promise.all([
    generateQrSvg(links.ios, { color: "#2b1d12", size: 180 }),
    generateQrSvg(links.android, { color: "#2b1d12", size: 180 }),
  ]);

  return (
    <div className="space-y-6">
      {/* Desktop: QR codes */}
      <div className="hidden lg:block">
        <p className="font-body text-sm uppercase tracking-[0.16em] text-ink-soft/70 mb-4">
          {messages.scanToInstall}
        </p>
        <div className="flex gap-6">
          <QrCard
            svg={iosQr}
            label={messages.iosLabel}
            url={links.ios}
            eventName="cta_ios_click"
          />
          <QrCard
            svg={androidQr}
            label={messages.androidLabel}
            url={links.android}
            eventName="cta_android_click"
          />
        </div>
      </div>

      {/* Mobile: store buttons. Client component handles per-OS visibility */}
      <MobileButtons
        platform={platform}
        messages={messages}
        links={links}
        variant={variant}
      />
    </div>
  );
}

function QrCard({
  svg,
  label,
  url,
  eventName,
}: {
  svg: string;
  label: string;
  url: string;
  eventName: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-ink/10 bg-white p-4 shadow-card">
      <div
        className="h-[180px] w-[180px]"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="font-body text-xs font-medium text-ink-soft">{label}</p>
      <a
        href={url}
        className="font-body text-xs text-accent hover:text-accent-deep underline"
        data-event={eventName}
      >
        {label.split(" — ")[0]}
      </a>
    </div>
  );
}

function MobileButtons({
  platform,
  messages,
  links,
  variant,
}: {
  platform: Platform;
  messages: Messages["hero"];
  links: { ios: string; android: string };
  variant: "hero" | "final";
}) {
  return (
    <div className="lg:hidden flex flex-col gap-3 items-stretch max-w-sm mx-auto">
      <MobileButtonClient
        platform={platform}
        iosLabel={messages.iosCta}
        androidLabel={messages.androidCta}
        iosUrl={links.ios}
        androidUrl={links.android}
        iosNote={messages.iosNote}
        variant={variant}
      />
    </div>
  );
}
