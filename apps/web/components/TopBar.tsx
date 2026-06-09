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
          {/* Lisa as the logo mark — a pre-composed circular avatar
              (transparent corners, full head with breathing room baked in)
              so it sits cleanly with no peach halo or clipped hairline. */}
          <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full shadow-card">
            <Image
              src="/lisa-avatar.png"
              alt=""
              fill
              sizes="36px"
              className="object-cover"
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
