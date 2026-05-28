import Link from "next/link";
import { Footer } from "./Footer";
import { getMessages, type Locale } from "@/lib/i18n";

interface Props {
  locale: Locale;
  children: React.ReactNode;
}

export function LegalLayout({ locale, children }: Props) {
  const m = getMessages(locale);
  const homeHref = locale === "fr" ? "/fr" : "/";
  return (
    <>
      <header className="border-b border-ink/10 bg-cream">
        <div className="max-w-content mx-auto px-6 py-4">
          <Link
            href={homeHref}
            className="font-display text-lg text-ink hover:text-accent transition"
          >
            My Language Coach
          </Link>
        </div>
      </header>
      <main className="max-w-content mx-auto px-6 py-12 md:py-16">
        <article className="prose prose-ink mx-auto max-w-2xl">
          {children}
        </article>
      </main>
      <Footer messages={m.footer} locale={locale} />
    </>
  );
}
