import type { Messages } from "@/lib/i18n";

interface Props {
  messages: Messages["valueStrip"];
}

const ICONS = ["🧠", "🎭", "📝", "🌐"];

export function ValueStrip({ messages }: Props) {
  const items = [messages.v1, messages.v2, messages.v3, messages.v4];
  return (
    <section className="border-y border-ink/10 bg-white">
      <div className="max-w-content mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((item, i) => (
          <div key={item} className="flex items-center gap-3 justify-center">
            <span className="text-xl" aria-hidden>
              {ICONS[i]}
            </span>
            <span className="font-body text-sm font-medium text-ink-soft">
              {item}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
