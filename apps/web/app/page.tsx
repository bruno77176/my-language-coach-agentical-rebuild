import { Hero } from "@/components/Hero";
import { ValueStrip } from "@/components/ValueStrip";
import { Features } from "@/components/Features";
import { HowItWorks } from "@/components/HowItWorks";
import { LanguagesStrip } from "@/components/LanguagesStrip";
import { DownloadCTA } from "@/components/DownloadCTA";
import { Footer } from "@/components/Footer";
import { ScrollDepthTracker } from "@/components/ScrollDepthTracker";
import { getMessages } from "@/lib/i18n";

export default async function HomePage() {
  const m = getMessages("en");
  return (
    <main>
      <ScrollDepthTracker />
      <Hero messages={m.hero} />
      <ValueStrip messages={m.valueStrip} />
      <Features messages={m.features} />
      <HowItWorks messages={m.howItWorks} />
      <LanguagesStrip messages={m.languages} />
      <FinalCta
        title={m.finalCta.title}
        subtitle={m.finalCta.subtitle}
        heroMessages={m.hero}
      />
      <Footer messages={m.footer} locale="en" />
    </main>
  );
}

async function FinalCta({
  title,
  subtitle,
  heroMessages,
}: {
  title: string;
  subtitle: string;
  heroMessages: ReturnType<typeof getMessages>["hero"];
}) {
  return (
    <section className="py-section-y bg-sunrise">
      <div className="max-w-content mx-auto px-6 text-center space-y-8">
        <h2 className="font-display text-3xl md:text-4xl text-ink">{title}</h2>
        <p className="font-body text-lg text-ink-soft max-w-xl mx-auto">
          {subtitle}
        </p>
        <div className="flex justify-center">
          <DownloadCTA messages={heroMessages} variant="final" />
        </div>
      </div>
    </section>
  );
}
