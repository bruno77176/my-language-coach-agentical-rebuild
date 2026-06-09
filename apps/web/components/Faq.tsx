import type { Messages } from "@/lib/i18n";

interface Props {
  messages: Messages["faq"];
}

export function Faq({ messages }: Props) {
  // FAQPage structured data — eligible for rich results and frequently cited
  // by AI answer engines. Built from the same copy the section renders.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: messages.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <section className="py-section-y bg-white">
      <div className="max-w-3xl mx-auto px-6 space-y-10">
        <h2 className="font-display text-3xl md:text-4xl text-ink text-center">
          {messages.title}
        </h2>
        <dl className="space-y-8">
          {messages.items.map((item) => (
            <div key={item.q} className="space-y-2">
              <dt className="font-display text-lg md:text-xl text-ink">
                {item.q}
              </dt>
              <dd className="font-body text-base text-ink-soft leading-relaxed">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </section>
  );
}
