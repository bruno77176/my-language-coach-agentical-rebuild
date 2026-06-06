import { useQuery } from "@tanstack/react-query";
import { fetchVocabDeck } from "./api";

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
