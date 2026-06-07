import type { Messages } from "@/lib/i18n";

interface Props {
  messages: Messages["languages"];
}

// Mirrors the learnable languages in @language-coach/shared (LANGUAGES).
const LANGUAGES: Array<{ flag: string; name: string }> = [
  { flag: "🇬🇧", name: "English" },
  { flag: "🇫🇷", name: "Français" },
  { flag: "🇩🇪", name: "Deutsch" },
  { flag: "🇮🇹", name: "Italiano" },
  { flag: "🇪🇸", name: "Español" },
  { flag: "🇵🇹", name: "Português" },
  { flag: "🇹🇷", name: "Türkçe" },
  { flag: "🇸🇪", name: "Svenska" },
  { flag: "🇩🇰", name: "Dansk" },
  { flag: "🇷🇺", name: "Русский" },
  { flag: "🇷🇴", name: "Română" },
  { flag: "🇭🇺", name: "Magyar" },
  { flag: "🇯🇵", name: "日本語" },
  { flag: "🇨🇳", name: "中文" },
  { flag: "🇰🇷", name: "한국어" },
];

export function LanguagesStrip({ messages }: Props) {
  return (
    <section className="py-section-y bg-cream">
      <div className="max-w-content mx-auto px-6 space-y-8 text-center">
        <h2 className="font-display text-3xl md:text-4xl text-ink">
          {messages.title}
        </h2>
        <div className="flex flex-wrap justify-center gap-3">
          {LANGUAGES.map((l) => (
            <span
              key={l.name}
              className="inline-flex items-center gap-2 rounded-pill bg-white border border-ink/10 px-4 py-2 font-body text-sm text-ink shadow-card"
            >
              <span className="text-lg" aria-hidden>
                {l.flag}
              </span>
              {l.name}
            </span>
          ))}
          <span className="inline-flex items-center rounded-pill bg-ink/5 px-4 py-2 font-body text-sm text-ink-soft italic">
            {messages.more}
          </span>
        </div>
      </div>
    </section>
  );
}
