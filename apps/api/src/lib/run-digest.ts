import type {
  MemoryItemCandidate,
  MemoryItemType,
} from "@language-coach/shared";
import type { TranscriptTurn } from "./extract-memory";
import { planConsolidation } from "./consolidate-memory";

export type RunDigestDeps = {
  extractItems: (
    transcript: TranscriptTurn[],
    languageCode: string,
  ) => Promise<MemoryItemCandidate[]>;
  embed: (texts: string[]) => Promise<(number[] | null)[]>;
  getActiveItems: () => Promise<
    {
      id: string;
      type: MemoryItemType;
      embedding: number[] | null;
      salience: number;
    }[]
  >;
  insertItem: (item: {
    type: MemoryItemType;
    content: string;
    embedding: number[] | null;
  }) => Promise<void>;
  bumpItem: (id: string, newSalience: number) => Promise<void>;
};

export async function runDigest(
  input: { transcript: TranscriptTurn[]; languageCode: string },
  deps: RunDigestDeps,
): Promise<{ inserted: number; bumped: number }> {
  const candidates = await deps.extractItems(
    input.transcript,
    input.languageCode,
  );
  if (candidates.length === 0) return { inserted: 0, bumped: 0 };
  const embeddings = await deps.embed(candidates.map((c) => c.content));
  const existing = await deps.getActiveItems();
  const decisions = planConsolidation(
    candidates.map((c, i) => ({
      type: c.type,
      content: c.content,
      embedding: embeddings[i] ?? null,
    })),
    existing,
  );
  let inserted = 0;
  let bumped = 0;
  for (const d of decisions) {
    if (d.kind === "insert") {
      const c = candidates[d.candidateIndex]!;
      await deps.insertItem({
        type: c.type,
        content: c.content,
        embedding: embeddings[d.candidateIndex] ?? null,
      });
      inserted++;
    } else {
      await deps.bumpItem(d.existingId, d.newSalience);
      bumped++;
    }
  }
  return { inserted, bumped };
}
