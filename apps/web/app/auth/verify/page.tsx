import Link from "next/link";

// This page only renders when the OS did NOT intercept the link — i.e. the
// user is on desktop, the app isn't installed, or App/Universal Links
// verification hasn't completed yet. When the app IS installed and verified,
// the OS opens it directly and this page never loads.
//
// The <meta http-equiv="refresh"> tag below is a last-ditch fallback to
// attempt the custom-scheme deep link from the rendered page; harmless if
// it fails (browser stays on this page).

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.anonymous.mylanguagecoach";
const APP_STORE_URL = "https://apps.apple.com/app/my-language-coach";

export default function VerifyPage({
  searchParams,
}: {
  searchParams: { token?: string; type?: string };
}) {
  const customSchemeUrl = searchParams.token
    ? `mylanguagecoach://verify?token=${encodeURIComponent(searchParams.token)}&type=${encodeURIComponent(searchParams.type ?? "signup")}`
    : "mylanguagecoach://verify";

  return (
    <>
      <meta httpEquiv="refresh" content={`0; url=${customSchemeUrl}`} />
      <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 text-center">
        <h1 className="font-serif text-4xl font-semibold text-[#1a1a1a]">
          Email confirmed
        </h1>
        <p className="mt-4 max-w-md text-lg text-[#1a1a1a]/70">
          Open My Language Coach on your phone to finish signing in.
        </p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href={PLAY_STORE_URL}
            className="rounded-full bg-[#1a1a1a] px-6 py-3 text-white"
          >
            Get it on Google Play
          </Link>
          <Link
            href={APP_STORE_URL}
            className="rounded-full border border-[#1a1a1a] px-6 py-3 text-[#1a1a1a]"
          >
            Download on App Store
          </Link>
        </div>
      </div>
    </>
  );
}
