import Image from "next/image";
import { PhoneFrame } from "./PhoneFrame";
import { DownloadCTA } from "./DownloadCTA";
import type { Messages } from "@/lib/i18n";

interface HeroProps {
  messages: Messages["hero"];
}

export async function Hero({ messages }: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-sunrise">
      <div className="absolute inset-0 bg-warmth pointer-events-none" />
      <div className="relative max-w-content mx-auto px-6 py-16 md:py-24 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
        <div className="space-y-6">
          <p className="font-body text-xs uppercase tracking-[0.18em] text-accent-deep">
            {messages.eyebrow}
          </p>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.05] text-ink">
            {messages.headline}
            <br />
            <span className="text-accent">{messages.headlineAccent}</span>
          </h1>
          <p className="font-body text-lg text-ink-soft max-w-md">
            {messages.subheadline}
          </p>
          <DownloadCTA messages={messages} variant="hero" />
        </div>
        <div className="relative flex justify-center items-center">
          <div className="flex gap-4 items-end">
            <PhoneFrame
              src="/screens/home.png"
              alt="Home screen"
              widthClass="w-[200px]"
              rotate={-4}
              priority
            />
            <PhoneFrame
              src="/screens/practice.png"
              alt="Practice screen"
              widthClass="w-[240px]"
              priority
            />
            <PhoneFrame
              src="/screens/progress.png"
              alt="Progress screen"
              widthClass="w-[200px]"
              rotate={4}
              priority
            />
          </div>
          <Image
            src="/character.png"
            alt=""
            width={120}
            height={120}
            className="absolute -bottom-4 -left-6 select-none pointer-events-none"
          />
        </div>
      </div>
    </section>
  );
}
