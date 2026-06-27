import type { MemoryItemType } from "@language-coach/shared";

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export type ConsolidationCandidate = {
  type: MemoryItemType;
  content: string;
  embedding: number[] | null;
};
export type ConsolidationExisting = {
  id: string;
  type: MemoryItemType;
  embedding: number[] | null;
  salience: number;
};
export type ConsolidationDecision =
  | { kind: "insert"; candidateIndex: number }
  | {
      kind: "bump";
      existingId: string;
      newSalience: number;
      candidateIndex: number;
    };

export function planConsolidation(
  candidates: ConsolidationCandidate[],
  existing: ConsolidationExisting[],
  opts: { threshold?: number; salienceBump?: number } = {},
): ConsolidationDecision[] {
  const threshold = opts.threshold ?? 0.86;
  const bump = opts.salienceBump ?? 0.1;
  return candidates.map((cand, candidateIndex) => {
    if (!cand.embedding) return { kind: "insert", candidateIndex };
    let best: { existing: ConsolidationExisting; sim: number } | null = null;
    for (const ex of existing) {
      if (ex.type !== cand.type || !ex.embedding) continue;
      const sim = cosineSimilarity(cand.embedding, ex.embedding);
      if (sim >= threshold && (!best || sim > best.sim))
        best = { existing: ex, sim };
    }
    if (best) {
      const newSalience = Math.min(
        1,
        Number((best.existing.salience + bump).toFixed(10)),
      );
      return {
        kind: "bump",
        existingId: best.existing.id,
        newSalience,
        candidateIndex,
      };
    }
    return { kind: "insert", candidateIndex };
  });
}
