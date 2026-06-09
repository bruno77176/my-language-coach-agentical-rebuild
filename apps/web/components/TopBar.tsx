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
          {/* Lisa as the logo mark — exported from the app's loading avatar
              (avatar.json) so the web brand mark matches the app exactly:
              a clean teal disc, full head, transparent corners. */}
          <span className="relative h-9 w-9 shrink-0">
            <Image
              src="/lisa-avatar.png"
              alt=""
              fill
              sizes="36px"
              className="object-contain drop-shadow-sm"
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
