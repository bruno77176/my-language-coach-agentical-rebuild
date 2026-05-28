import { UAParser } from "ua-parser-js";

export type Platform = "ios" | "android" | "desktop" | "unknown";

export function detectPlatform(ua: string | null | undefined): Platform {
  if (!ua) return "unknown";

  const parser = new UAParser(ua);
  const os = parser.getOS().name?.toLowerCase() ?? "";

  if (os === "ios") return "ios";
  if (os === "android") return "android";
  return "desktop";
}
