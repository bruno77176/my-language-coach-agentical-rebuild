"use client";

import { useEffect, useState } from "react";
import { detectPlatform, type Platform } from "@/lib/ua-detect";
import { track } from "@vercel/analytics";

interface Props {
  platform: Platform;
  iosLabel: string;
  androidLabel: string;
  iosUrl: string;
  androidUrl: string;
  iosNote: string;
  variant: "hero" | "final";
}

export function MobileButtonClient({
  platform: serverPlatform,
  iosLabel,
  androidLabel,
  iosUrl,
  androidUrl,
  iosNote,
  variant,
}: Props) {
  const [platform, setPlatform] = useState<Platform>(serverPlatform);

  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent));
  }, []);

  const showIos = platform === "ios" || platform === "unknown";
  const showAndroid = platform === "android" || platform === "unknown";

  return (
    <>
      {showIos && (
        <>
          <a
            href={iosUrl}
            className="btn-primary w-full"
            onClick={() => track("cta_ios_click", { variant })}
          >
            {iosLabel}
          </a>
          <p className="font-body text-xs text-ink-soft/70 text-center">
            {iosNote}
          </p>
        </>
      )}
      {showAndroid && (
        <a
          href={androidUrl}
          className="btn-primary w-full"
          onClick={() => track("cta_android_click", { variant })}
        >
          {androidLabel}
        </a>
      )}
    </>
  );
}
