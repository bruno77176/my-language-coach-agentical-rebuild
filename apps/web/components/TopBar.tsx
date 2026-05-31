import { LanguagePicker } from "./LanguagePicker";
import type { Locale } from "@/lib/i18n";

interface Props {
  locale: Locale;
}

// Fixed top bar that holds the language picker. Sits above the hero,
// transparent over the sunrise gradient so it doesn't compete with the
// hero copy.
export function TopBar({ locale }: Props) {
  return (
    <div className="absolute top-0 inset-x-0 z-30 pointer-events-none">
      <div className="max-w-content mx-auto px-6 pt-4 flex justify-end">
        <div className="pointer-events-auto">
          <LanguagePicker currentLocale={locale} />
        </div>
      </div>
    </div>
  );
}
