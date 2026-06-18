"use client";

import { useEffect, useState } from "react";
import { detectPlatform, type Platform } from "@/lib/ua-detect";
import { track } from "@vercel/analytics";
import type { Messages } from "@/lib/i18n";

interface Props {
  serverPlatform: Platform;
  links: { ios: string; android: string };
  iosQrSvg: string;
  androidQrSvg: string;
  messages: Messages["hero"];
  variant: "hero" | "final";
}

export function DownloadCTAView({
  serverPlatform,
  links,
  iosQrSvg,
  androidQrSvg,
  messages,
  variant,
}: Props) {
  const [platform, setPlatform] = useState<Platform>(serverPlatform);

  useEffect(() => {
    setPlatform(detectClientPlatform());
  }, []);

  const isMobileLike =
    platform === "ios" || platform === "android" || platform === "unknown";
  const showIos = platform === "ios" || platform === "unknown";
  const showAndroid = platform === "android" || platform === "unknown";

  if (isMobileLike) {
    return (
      <div className="flex flex-col gap-3 items-stretch max-w-sm">
        {showIos && (
          <a
            href={links.ios}
            className="btn-primary w-full"
            onClick={() => track("cta_ios_click", { variant })}
          >
            {messages.iosCta}
          </a>
        )}
        {showAndroid && (
          <a
            href={links.android}
            className="btn-primary w-full"
            onClick={() => track("cta_android_click", { variant })}
          >
            {messages.androidCta}
          </a>
        )}
      </div>
    );
  }

  return (
    <div>
      <p className="font-body text-sm uppercase tracking-[0.16em] text-ink-soft/70 mb-4">
        {messages.scanToInstall}
      </p>
      <div className="flex flex-wrap gap-6">
        <QrCard
          svg={iosQrSvg}
          label={messages.iosLabel}
          url={links.ios}
          eventName="cta_ios_click"
          variant={variant}
        />
        <QrCard
          svg={androidQrSvg}
          label={messages.androidLabel}
          url={links.android}
          eventName="cta_android_click"
          variant={variant}
        />
      </div>
    </div>
  );
}

function QrCard({
  svg,
  label,
  url,
  eventName,
  variant,
}: {
  svg: string;
  label: string;
  url: string;
  eventName: string;
  variant: "hero" | "final";
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
        onClick={() => track(eventName, { variant })}
      >
        {label.split(" — ")[0]}
      </a>
    </div>
  );
}

// iPadOS 13+ Safari reports a Mac UA string, so server-side detectPlatform sees
// it as "desktop". Touch-points + Mac UA is the standard workaround.
function detectClientPlatform(): Platform {
  if (typeof navigator === "undefined") return "unknown";
  const base = detectPlatform(navigator.userAgent);
  if (base !== "desktop") return base;
  const isIpad =
    /Mac/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  return isIpad ? "ios" : "desktop";
}
