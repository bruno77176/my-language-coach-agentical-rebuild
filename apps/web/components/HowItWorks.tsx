import type { Messages } from "@/lib/i18n";

interface Props {
  messages: Messages["howItWorks"];
}

export function HowItWorks({ messages }: Props) {
  const steps = [messages.s1, messages.s2, messages.s3];
  return (
    <section className="py-section-y bg-white">
      <div className="max-w-content mx-auto px-6 space-y-12">
        <h2 className="font-display text-3xl md:text-4xl text-ink text-center">
          {messages.title}
        </h2>
        <ol className="grid md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <li key={step.n} className="flex flex-col items-center text-center gap-3">
              <span className="inline-flex items-center justify-center h-12 w-12 rounded-pill bg-accent text-cream font-display text-xl">
                {step.n}
              </span>
              <h3 className="font-display text-xl text-ink">{step.title}</h3>
              <p className="font-body text-base text-ink-soft max-w-xs">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
