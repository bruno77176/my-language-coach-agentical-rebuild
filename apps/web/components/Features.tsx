import { PhoneFrame } from "./PhoneFrame";
import type { Messages } from "@/lib/i18n";

interface Props {
  messages: Messages["features"];
}

const SCREENS: Array<{ src: string; alt: string }> = [
  {
    src: "/screens/practice.jpeg",
    alt: "Practice screen showing live conversation",
  },
  {
    src: "/screens/home-review.jpeg",
    alt: "Home screen with daily goal and words to review",
  },
  {
    src: "/screens/feedback.jpeg",
    alt: "Feedback report with highlights, corrections and new vocabulary",
  },
];

export function Features({ messages }: Props) {
  const cards = [messages.f1, messages.f2, messages.f3];
  return (
    <section className="py-section-y bg-cream">
      <div className="max-w-content mx-auto px-6 space-y-12">
        <h2 className="font-display text-3xl md:text-4xl text-ink text-center">
          {messages.title}
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {cards.map((card, i) => {
            const screen = SCREENS[i];
            return (
              <article
                key={card.title}
                className="flex flex-col items-center text-center gap-4"
              >
                {screen && (
                  <PhoneFrame
                    src={screen.src}
                    alt={screen.alt}
                    widthClass="w-[200px]"
                  />
                )}
                <h3 className="font-display text-xl text-ink">{card.title}</h3>
                <p className="font-body text-base text-ink-soft max-w-xs">
                  {card.body}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
