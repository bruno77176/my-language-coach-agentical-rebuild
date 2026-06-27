import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchQuoteLikes, setQuoteLiked } from "./api";

const QUOTE_LIKES_KEY = ["quote-likes"] as const;

export function useQuoteLikes() {
  return useQuery({ queryKey: QUOTE_LIKES_KEY, queryFn: fetchQuoteLikes });
}

export function useToggleQuoteLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { quoteId: string; liked: boolean }) =>
      setQuoteLiked(input.quoteId, input.liked),
    // Optimistic: flip the heart instantly, roll back on error.
    onMutate: async ({ quoteId, liked }) => {
      await qc.cancelQueries({ queryKey: QUOTE_LIKES_KEY });
      const prev = qc.getQueryData<string[]>(QUOTE_LIKES_KEY) ?? [];
      const next = liked
        ? [...new Set([...prev, quoteId])]
        : prev.filter((id) => id !== quoteId);
      qc.setQueryData<string[]>(QUOTE_LIKES_KEY, next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUOTE_LIKES_KEY, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUOTE_LIKES_KEY }),
  });
}
