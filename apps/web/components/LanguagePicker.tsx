"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { track } from "@vercel/analytics";
import { LOCALES, LOCALE_META, localizedPath, type Locale } from "@/lib/i18n";

interface Props {
  currentLocale: Locale;
}

export function LanguagePicker({ currentLocale }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname() ?? "/";
  const current = LOCALE_META[currentLocale];

  // Close when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Change language. Current language: ${current.englishName}`}
        className="flex items-center gap-2 bg-white/70 backdrop-blur-sm border border-ink/10 rounded-pill px-3 py-1.5 font-body text-sm text-ink hover:bg-white shadow-card transition-colors"
      >
        <span aria-hidden className="text-base leading-none">
          {current.flag}
        </span>
        <span className="font-medium">{current.nativeName}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M2 4l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-card border border-ink/5 overflow-hidden z-50 max-h-[70vh] overflow-y-auto"
        >
          {LOCALES.map((loc) => {
            const meta = LOCALE_META[loc];
            const isCurrent = loc === currentLocale;
            return (
              <li key={loc} role="option" aria-selected={isCurrent}>
                <Link
                  href={localizedPath(pathname, loc)}
                  onClick={() => {
                    setOpen(false);
                    track("language_switch", { to: loc });
                  }}
                  className={`flex items-center gap-3 px-4 py-2.5 font-body text-sm hover:bg-cream transition-colors ${
                    isCurrent
                      ? "bg-cream text-ink font-medium"
                      : "text-ink-soft"
                  }`}
                >
                  <span aria-hidden className="text-base leading-none">
                    {meta.flag}
                  </span>
                  <span className="flex-1">{meta.nativeName}</span>
                  {isCurrent && (
                    <span aria-hidden className="text-accent">
                      ✓
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
