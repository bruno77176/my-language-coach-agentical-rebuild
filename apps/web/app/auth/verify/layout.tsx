import type { ReactNode } from "react";

// Strip the marketing site's nav + footer for this page. Users land here
// after clicking an email confirmation link and we want a focused screen,
// not the landing-page chrome.
export default function VerifyLayout({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-[#fde7d1]">{children}</main>;
}
