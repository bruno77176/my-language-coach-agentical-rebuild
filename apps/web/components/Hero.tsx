import { PhoneFrame } from "./PhoneFrame";
import { DownloadCTA } from "./DownloadCTA";
import { HeroText } from "./motion/HeroText";
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
          <Reveal delay={0.9}>
            <DownloadCTA messages={messages} variant="hero" />
          </Reveal>
        </div>
        <div className="relative flex justify-center items-center">
          <div className="flex gap-2 sm:gap-4 items-end justify-center w-full">
            <PhoneFrame
              src="/screens/home.jpeg"
              alt="Home screen"
              widthClass="hidden sm:block w-[140px] md:w-[170px] lg:w-[200px]"
              rotate={-4}
              priority
            />
            <PhoneFrame
              src="/screens/practice.jpeg"
              alt="Practice screen"
              widthClass="w-[180px] sm:w-[180px] md:w-[210px] lg:w-[240px]"
              priority
            />
            <PhoneFrame
              src="/screens/progress.jpeg"
              alt="Progress screen"
              widthClass="hidden sm:block w-[140px] md:w-[170px] lg:w-[200px]"
              rotate={4}
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
