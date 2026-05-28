"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";

export function ScrollDepthTracker() {
  useEffect(() => {
    let fired50 = false;
    let fired100 = false;

    const onScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const ratio = window.scrollY / docHeight;

      if (!fired50 && ratio >= 0.5) {
        fired50 = true;
        track("scroll_depth_50");
      }
      if (!fired100 && ratio >= 0.98) {
        fired100 = true;
        track("scroll_depth_100");
        window.removeEventListener("scroll", onScroll);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return null;
}
