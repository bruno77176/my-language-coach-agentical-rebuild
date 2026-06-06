import { useQuery } from "@tanstack/react-query";
import { fetchVocabDeck } from "./api";

export function vocabDeckKey(language: string) {
  return ["vocab-deck", language] as const;
}

export function useVocabDeck(language: string | undefined) {
  return useQuery({
    queryKey: vocabDeckKey(language ?? "en"),
    queryFn: () => fetchVocabDeck(language ?? "en"),
    enabled: !!language,
  });
}
