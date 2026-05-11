import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  quoteForDay,
  type DailyQuote,
  type SupportedLang,
} from "@language-coach/shared";

const STORAGE_KEY = "lc.offline-quote.v1";

type Cached = {
  date: string; // YYYY-MM-DD
  timezone: string;
  nativeLang: SupportedLang;
  quote: DailyQuote;
};

async function readCache(): Promise<Cached | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
}

async function writeCache(value: Cached): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* best-effort */
  }
}

function isoDate(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
    new Date(),
  );
}

/**
 * Returns today's quote. If a profile is available, computes it live and
 * writes it to AsyncStorage. If no profile (e.g. offline first paint), reads
 * the cache so Home renders something useful instead of an empty spinner.
 */
export function useOfflineQuote(
  profile: { timezone: string; native_lang: string } | null | undefined,
): DailyQuote | null {
  const [quote, setQuote] = useState<DailyQuote | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (profile) {
      const q = quoteForDay(new Date(), profile.timezone);
      setQuote(q);
      void writeCache({
        date: isoDate(profile.timezone),
        timezone: profile.timezone,
        nativeLang: profile.native_lang as SupportedLang,
        quote: q,
      });
    } else {
      void readCache().then((cached) => {
        if (cancelled || !cached) return;
        setQuote(cached.quote);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [profile]);

  return quote;
}
