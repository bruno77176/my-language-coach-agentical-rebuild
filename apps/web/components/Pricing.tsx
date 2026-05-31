import type { Messages } from "@/lib/i18n";

interface Props {
  messages: Messages["pricing"];
}

export function Pricing({ messages }: Props) {
  return (
    <section className="py-section-y bg-cream">
      <div className="max-w-content mx-auto px-6 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="font-display text-3xl md:text-4xl text-ink">
            {messages.title}
          </h2>
          <p className="font-body text-base md:text-lg text-ink-soft">
            {messages.subtitle}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {/* Free */}
          <article className="bg-white rounded-lg shadow-card p-8 space-y-5">
            <div className="space-y-2">
              <p className="font-body text-xs uppercase tracking-[0.18em] text-ink-soft">
                {messages.free.label}
              </p>
              <h3 className="font-display text-2xl text-ink">
                {messages.free.headline}
              </h3>
            </div>
            <div className="space-y-1">
              <p className="font-display text-3xl text-ink">
                {messages.free.price}
              </p>
              <p className="font-body text-sm text-ink-soft">
                {messages.free.priceNote}
              </p>
            </div>
            <ul className="space-y-2 font-body text-sm text-ink-soft">
              {messages.free.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="text-accent">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>

          {/* Pro */}
          <article className="bg-ink text-cream rounded-lg shadow-card p-8 space-y-5 relative">
            {messages.pro.highlight && (
              <span className="absolute -top-3 right-6 inline-flex items-center bg-accent text-cream font-body text-xs px-3 py-1 rounded-pill shadow-card">
                {messages.pro.highlight}
              </span>
            )}
            <div className="space-y-2">
              <p className="font-body text-xs uppercase tracking-[0.18em] text-cream/70">
                {messages.pro.label}
              </p>
              <h3 className="font-display text-2xl text-cream">
                {messages.pro.headline}
              </h3>
            </div>
            <div className="space-y-1">
              <p className="font-display text-3xl text-cream">
                {messages.pro.price}
              </p>
              <p className="font-body text-sm text-cream/70">
                {messages.pro.priceAnnual}
              </p>
              <p className="font-body text-sm text-cream/70">
                {messages.pro.priceNote}
              </p>
            </div>
            <ul className="space-y-2 font-body text-sm text-cream/90">
              {messages.pro.items.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="text-accent">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <p className="font-body text-sm text-ink-soft text-center max-w-xl mx-auto">
          {messages.footnote}
        </p>
      </div>
    </section>
  );
}
