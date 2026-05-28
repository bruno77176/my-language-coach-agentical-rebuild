import { NextResponse } from "next/server";
import { buildAssetLinks } from "@/lib/well-known";

// Production Android signing key SHA-256 fingerprint. Extracted from Play
// Console → App integrity → App signing key certificate. If this is wrong,
// Google's App Links auto-verification fails and Android shows the
// "open with…" chooser instead of opening the app directly. Update + redeploy
// if the production keystore ever rotates.
const SHA256_FINGERPRINT =
  "BC:37:D5:24:28:76:AE:B6:CF:0C:BB:22:F0:C3:9A:59:28:1A:BC:D3:14:84:74:A6:7A:02:D2:9D:C5:61:2D:2E";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(buildAssetLinks(SHA256_FINGERPRINT), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
