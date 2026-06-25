import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addVocab,
  removeVocab,
  reviewVocab,
  setVocabStarred,
  type ReviewResult,
  type VocabDeckResponse,
} from "./api";
import { vocabDeckKey } from "./use-vocab-deck";

export function useAddVocab(language: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      term: string;
      translation?: string;
      source_sentence?: string;
    }) => addVocab({ language, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: vocabDeckKey(language) }),
  });
}

export function useReviewVocab(language: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; result: ReviewResult }) =>
      reviewVocab(input.id, input.result),
    onSuccess: () => qc.invalidateQueries({ queryKey: vocabDeckKey(language) }),
  });
}

export function useToggleStar(language: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; starred: boolean }) =>
      setVocabStarred(input.id, input.starred),
    // Optimistic: flip the star in place across every cached deck variant so the
    // word stays visible in "All" with its star toggled (the previous version
    // refetched the whole deck, and during that refetch the just-starred word
    // would flicker out of the "All" list). For the starred-only variant, drop
    // the word when unstarring so that filtered list stays accurate.
    onMutate: async ({ id, starred }) => {
      await qc.cancelQueries({ queryKey: vocabDeckKey(language) });
      const prev = qc.getQueriesData<VocabDeckResponse>({
        queryKey: vocabDeckKey(language),
      });
      for (const [key, data] of prev) {
        if (!data) continue;
        const starredOnlyVariant = key[2] === true;
        let items = data.items.map((it) =>
          it.id === id ? { ...it, starred } : it,
        );
        if (starredOnlyVariant && !starred) {
          items = items.filter((it) => it.id !== id);
        }
        qc.setQueryData<VocabDeckResponse>(key, {
          ...data,
          items,
          starredCount: items.filter((i) => i.starred).length,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.prev.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    // Reconcile with the server once the dust settles (covers the starred-only
    // list needing the full row when a word is starred from the "All" tab).
    onSettled: () => qc.invalidateQueries({ queryKey: vocabDeckKey(language) }),
  });
}

export function useRemoveVocab(language: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeVocab(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: vocabDeckKey(language) }),
  });
}
