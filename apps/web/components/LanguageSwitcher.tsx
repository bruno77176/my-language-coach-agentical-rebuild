"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { track } from "@vercel/analytics";
import { localizedPath, otherLocale, type Locale } from "@/lib/i18n";

interface Props {
  currentLocale: Locale;
  label: string;
}

export function LanguageSwitcher({ currentLocale, label }: Props) {
  const pathname = usePathname() ?? "/";
  const target = otherLocale(currentLocale);
  const href = localizedPath(pathname, target);

  return (
    <Link
      href={href}
      className="font-body text-sm text-ink-soft underline-offset-4 hover:underline"
      onClick={() => track("language_switch", { to: target })}
    >
      {label}
    </Link>
  );
}
