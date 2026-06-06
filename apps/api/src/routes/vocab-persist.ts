import type { Database } from "../db";
import { vocabItems } from "../db/schema";

export type PersistVocabInput = {
  userId: string;
  language: string;
  vocab: Array<{ term: string; translation?: string | null }>;
};

// Upsert session-extracted vocab into the persistent flashcard deck. Deduped
// on the (user_id, language, term) unique constraint. Best-effort: callers run
// this fire-and-forget so failures never block the response.
export async function persistVocab(
  db: Database,
  input: PersistVocabInput,
): Promise<void> {
  for (const v of input.vocab) {
    if (!v.term) continue;
    await db
      .insert(vocabItems)
      .values({
        userId: input.userId,
        language: input.language,
        term: v.term,
        translation: v.translation ?? null,
      })
      .onConflictDoNothing();
  }
}
