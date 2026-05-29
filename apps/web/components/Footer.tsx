import Link from "next/link";
import { LanguageSwitcher } from "./LanguageSwitcher";
import type { Messages, Locale } from "@/lib/i18n";

interface FooterProps {
  messages: Messages["footer"];
  locale: Locale;
}

export function Footer({ messages, locale }: FooterProps) {
  const prefix = locale === "fr" ? "/fr" : "";
  const contactEmail =
    process.env.NEXT_PUBLIC_CONTACT_EMAIL || "bruno.a.moise@gmail.com";

  return (
    <footer className="border-t border-ink/10 bg-cream">
      <div className="max-w-content mx-auto px-6 py-12 flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="font-display text-lg text-ink">My Language Coach</p>
          <p className="font-body text-sm text-ink-soft">{messages.tagline}</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 font-body text-sm text-ink-soft">
          <Link href={`${prefix}/privacy`} className="hover:text-ink">
            {messages.links.privacy}
          </Link>
          <Link href={`${prefix}/terms`} className="hover:text-ink">
            {messages.links.terms}
          </Link>
          <Link
            href={`${prefix}/delete-account`}
            className="hover:text-ink"
          >
            {messages.links.deleteAccount}
          </Link>
          <a href={`mailto:${contactEmail}`} className="hover:text-ink">
            {messages.links.contact}
          </a>
          <LanguageSwitcher
            currentLocale={locale}
            label={messages.switchLanguage}
          />
        </nav>
      </div>
      <div className="max-w-content mx-auto px-6 pb-6">
        <p className="font-body text-xs text-ink-soft/60">
          {messages.copyright}
        </p>
      </div>
    </footer>
  );
}
