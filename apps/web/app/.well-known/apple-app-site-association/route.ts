import { NextResponse } from "next/server";
import { buildAppleAppSiteAssociation } from "@/lib/well-known";

// iOS fetches this file with a strict Content-Type expectation
// (application/json) and NO file extension in the URL. The directory name
// includes the extensionless filename so the resulting URL is exactly:
//   https://www.mylanguagecoach.app/.well-known/apple-app-site-association
//
// iOS REFUSES to follow redirects when fetching this file. The
// mylanguagecoach.app apex 307s to www, which is why all app config + this
// route assume the www host.

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(buildAppleAppSiteAssociation(), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
