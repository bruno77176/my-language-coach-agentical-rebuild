import { Footer } from "./Footer";
import { getMessages, type Locale } from "@/lib/i18n";

interface Props {
  locale: Locale;
  children: React.ReactNode;
}

export function LegalLayout({ locale, children }: Props) {
  const m = getMessages(locale);
  return (
    <>
      <main className="max-w-content mx-auto px-6 py-16">
        <article className="prose prose-ink mx-auto max-w-2xl">
          {children}
        </article>
      </main>
      <Footer messages={m.footer} locale={locale} />
    </>
  );
}
