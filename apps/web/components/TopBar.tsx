import Image from "next/image";
import { LanguagePicker } from "./LanguagePicker";
import { localizedPath, type Locale } from "@/lib/i18n";

interface Props {
  locale: Locale;
}

// Fixed top bar over the hero: brand lockup (Lisa + wordmark) on the left,
// language picker on the right. Transparent over the sunrise gradient.
export function TopBar({ locale }: Props) {
  return (
    <div className="absolute top-0 inset-x-0 z-30 pointer-events-none">
      <div className="max-w-content mx-auto px-6 pt-4 flex items-center justify-between gap-3">
        <a
          href={localizedPath("/", locale)}
          aria-label="My Language Coach — home"
          className="pointer-events-auto flex items-center gap-2.5"
        >
          {/* Lisa as the logo mark. The source art has her hair touching the
              top edge, so we scale it down inside a peach circle to keep her
              full head visible (no clipped hairline). */}
          <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#f8d7c4] shadow-card">
            <Image
              src="/character.png"
              alt=""
              fill
              sizes="36px"
              className="object-cover scale-[0.92]"
              priority
            />
          </span>
          <span className="font-display text-sm sm:text-base text-ink whitespace-nowrap">
            My Language Coach
          </span>
        </a>
        <div className="pointer-events-auto">
          <LanguagePicker currentLocale={locale} />
        </div>
      </div>
    </div>
  );
}
