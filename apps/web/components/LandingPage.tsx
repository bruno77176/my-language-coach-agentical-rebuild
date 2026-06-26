import { Hero } from "@/components/Hero";
import { ValueStrip } from "@/components/ValueStrip";
import { Features } from "@/components/Features";
import { Showcase } from "@/components/Showcase";
import { HowItWorks } from "@/components/HowItWorks";
import { LanguagesStrip } from "@/components/LanguagesStrip";
import { Faq } from "@/components/Faq";
import { DownloadCTA } from "@/components/DownloadCTA";
import { Footer } from "@/components/Footer";
import { ScrollDepthTracker } from "@/components/ScrollDepthTracker";
import { TopBar } from "@/components/TopBar";
import { Reveal } from "@/components/motion/Reveal";
import { getMessages, type Locale } from "@/lib/i18n";

interface Props {
  locale: Locale;
}

export function LandingPage({ locale }: Props) {
  const m = getMessages(locale);
  return (
    <main>
      <ScrollDepthTracker />
      <TopBar locale={locale} />
      <Hero messages={m.hero} />
      <Reveal>
        <ValueStrip messages={m.valueStrip} />
      </Reveal>
      <Reveal>
        <Features messages={m.features} />
      </Reveal>
      <Reveal>
        <Showcase
          messages={m.vocab}
          background="bg-white"
          imageRight
          images={[
            {
              src: "/screens/vocab-list.jpeg",
              alt: "Your saved words list with review counter",
            },
            {
              src: "/screens/flashcard.jpeg",
              alt: "Vocabulary flashcard prompting you to say the word",
            },
          ]}
        />
      </Reveal>
      <Reveal>
        <Showcase
          messages={m.voices}
          background="bg-cream"
          images={[
            {
              src: "/screens/voice.jpeg",
              alt: "Coach voice settings with provider, voice and speed options",
            },
          ]}
        />
      </Reveal>
      <Reveal>
        <HowItWorks messages={m.howItWorks} />
      </Reveal>
      <Reveal>
        <LanguagesStrip messages={m.languages} />
      </Reveal>
      <Reveal>
        <Faq messages={m.faq} />
      </Reveal>
      <Reveal>
        <FinalCta
          title={m.finalCta.title}
          subtitle={m.finalCta.subtitle}
          heroMessages={m.hero}
        />
      </Reveal>
      <Footer messages={m.footer} locale={locale} />
    </main>
  );
}

function FinalCta({
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
