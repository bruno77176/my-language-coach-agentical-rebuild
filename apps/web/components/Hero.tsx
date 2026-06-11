import { DownloadCTA } from "./DownloadCTA";
import { HeroText } from "./motion/HeroText";
import { HeroPhones } from "./motion/HeroPhones";
import { Reveal } from "./motion/Reveal";
import type { Messages } from "@/lib/i18n";

interface HeroProps {
  messages: Messages["hero"];
}

export async function Hero({ messages }: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-sunrise">
      <div className="absolute inset-0 bg-warmth pointer-events-none" />
      <div className="relative max-w-content mx-auto px-6 py-12 md:py-20 lg:py-24 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-12 items-center">
        <div className="space-y-5 md:space-y-6">
          <HeroText
            eyebrow={messages.eyebrow}
            painQuote={messages.painQuote}
            headline={messages.headline}
            headlineAccent={messages.headlineAccent}
            subheadline={messages.subheadline}
          />
          <Reveal delay={0.55}>
            <DownloadCTA messages={messages} variant="hero" />
          </Reveal>
        </div>
        <HeroPhones />
      </div>
    </section>
  );
}
