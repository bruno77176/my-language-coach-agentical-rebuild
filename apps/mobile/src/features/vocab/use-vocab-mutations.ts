import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addVocab, removeVocab, reviewVocab, type ReviewResult } from "./api";
import { vocabDeckKey } from "./use-vocab-deck";

export function useAddVocab(language: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { term: string; translation?: string }) =>
      addVocab({ language, ...input }),
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

export function useRemoveVocab(language: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removeVocab(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: vocabDeckKey(language) }),
  });
}
