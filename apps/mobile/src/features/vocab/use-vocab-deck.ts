import { useQuery } from "@tanstack/react-query";
import { fetchVocabDeck, fetchReviewToday } from "./api";

// Prefix key — mutations invalidate by this so both the full and starred-only
// variants refresh.
export function vocabDeckKey(language: string) {
  return ["vocab-deck", language] as const;
}

export function useVocabDeck(
  language: string | undefined,
  starredOnly = false,
) {
  return useQuery({
    queryKey: ["vocab-deck", language ?? "en", starredOnly] as const,
    queryFn: () => fetchVocabDeck(language ?? "en", starredOnly),
    enabled: !!language,
  });
}

// The scheduled daily review session (BRU-30). Shares the "vocab-deck" key
// prefix so the review mutations already invalidate it.
export function reviewTodayKey(language: string) {
  return ["vocab-review-today", language] as const;
}

export function useReviewToday(language: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["vocab-review-today", language ?? "en"] as const,
    queryFn: () => fetchReviewToday(language ?? "en"),
    enabled: !!language && enabled,
  });
}
