import { Hono } from "hono";
import { z } from "zod";
import { and, asc, desc, eq, type SQL } from "drizzle-orm";
import type { Database } from "../db";
import { vocabItems } from "../db/schema";
import type { OnUsage } from "../providers/usage";
import { makeOnUsage, platformFromHeader } from "../lib/usage-bridge";
import type { TranscribeInput, TranscribeResult } from "../providers/deepgram";
import { isPronunciationCorrect } from "../lib/vocab-match";

export type TranslateInput = {
  text: string;
  targetLanguageCode: string;
  onUsage?: OnUsage;
};
export type TranslateFn = (input: TranslateInput) => Promise<string>;
export type TranscribeFn = (
  input: TranscribeInput,
) => Promise<TranscribeResult>;

export type VocabDeps = {
  db: Database;
  translate: TranslateFn;
  transcribe: TranscribeFn;
};

const AddBody = z.object({
  language: z.string().min(2).max(8),
  term: z.string().min(1).max(120),
  translation: z.string().min(1).max(120).optional(),
});

const PatchBody = z.union([
  z.object({ result: z.enum(["got_it", "still_learning"]) }),
  z.object({ starred: z.boolean() }),
]);

const MAX_MASTERY = 3;

export function createVocabRoutes(deps: VocabDeps) {
  const routes = new Hono<{ Variables: { userId: string } }>();

  // GET /v1/vocab?language=xx&starred=true — the deck (optionally only starred
  // words), weakest first, plus dueCount + starredCount.
  routes.get("/", async (c) => {
    const userId = c.get("userId");
    let language = c.req.query("language");
    if (!language) {
      const profile = await deps.db.query.profiles.findFirst({
        where: (t, { eq: e }) => e(t.userId, userId),
      });
      language = profile?.targetLang ?? "en";
    }
    const lang = language;
    const starredOnly =
      c.req.query("starred") === "true" || c.req.query("starred") === "1";

    const items = await deps.db.query.vocabItems.findMany({
      where: (t, { eq: e, and: a }) => {
        const clauses: SQL[] = [e(t.userId, userId), e(t.language, lang)];
        if (starredOnly) clauses.push(e(t.starred, true));
        return a(...clauses);
      },
      orderBy: (t) => [asc(t.mastery), desc(t.createdAt)],
    });
    const dueCount = items.filter((i) => i.mastery < MAX_MASTERY).length;
    const starredCount = items.filter((i) => i.starred).length;
    return c.json({ items, dueCount, starredCount });
  });

  // POST /v1/vocab — manual add; auto-translate when translation omitted.
  routes.post("/", async (c) => {
    const userId = c.get("userId");
    const body = await c.req.json().catch(() => ({}));
    const parsed = AddBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: parsed.error.message } },
        400,
      );
    }
    const { language, term } = parsed.data;
    let translation: string | null = parsed.data.translation ?? null;

    if (!translation) {
      const profile = await deps.db.query.profiles.findFirst({
        where: (t, { eq: e }) => e(t.userId, userId),
      });
      const nativeLang = profile?.nativeLang ?? "en";
      try {
        const onUsage = makeOnUsage(deps.db, {
          userId,
          platform: platformFromHeader(c.req.header("X-Client-Platform")),
        });
        translation = await deps.translate({
          text: term,
          targetLanguageCode: nativeLang,
          onUsage,
        });
      } catch {
        // Best-effort: store the term alone if translation fails.
        translation = null;
      }
    }

    const inserted = await deps.db
      .insert(vocabItems)
      .values({ userId, language, term, translation })
      .onConflictDoNothing()
      .returning();

    if (inserted.length > 0) {
      return c.json({ item: inserted[0] });
    }

    // Conflict (already in deck) — return the existing row.
    const existing = await deps.db.query.vocabItems.findFirst({
      where: (t, { eq: e, and: a }) =>
        a(e(t.userId, userId), e(t.language, language), e(t.term, term)),
    });
    return c.json({ item: existing });
  });

  // PATCH /v1/vocab/:id — record a review result OR toggle the starred flag.
  routes.patch("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const parsed = PatchBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: parsed.error.message } },
        400,
      );
    }
    const row = await deps.db.query.vocabItems.findFirst({
      where: (t, { eq: e, and: a }) => a(e(t.id, id), e(t.userId, userId)),
    });
    if (!row) {
      return c.json({ error: { code: "NOT_FOUND" } }, 404);
    }

    const set =
      "result" in parsed.data
        ? {
            mastery:
              parsed.data.result === "got_it"
                ? Math.min(row.mastery + 1, MAX_MASTERY)
                : 0,
          }
        : { starred: parsed.data.starred };

    const updated = await deps.db
      .update(vocabItems)
      .set(set)
      .where(and(eq(vocabItems.id, id), eq(vocabItems.userId, userId)))
      .returning();
    return c.json({ item: updated[0] });
  });

  // POST /v1/vocab/:id/pronounce — the game's core. Accepts a short audio clip
  // of the user pronouncing the target term, transcribes it in the term's
  // language, and grades it: correct → mastery +1 ("got it"), otherwise
  // mastery reset to 0 ("still learning"). A silent / failed transcription is
  // treated as an incorrect attempt so the game keeps flowing.
  routes.post("/:id/pronounce", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");

    const row = await deps.db.query.vocabItems.findFirst({
      where: (t, { eq: e, and: a }) => a(e(t.id, id), e(t.userId, userId)),
    });
    if (!row) {
      return c.json({ error: { code: "NOT_FOUND" } }, 404);
    }

    const formData = await c.req.formData().catch(() => null);
    const file = formData?.get("audio");
    if (!file || typeof file === "string") {
      return c.json(
        { error: { code: "BAD_REQUEST", message: "Missing audio" } },
        400,
      );
    }
    const audioBuffer = Buffer.from(await file.arrayBuffer());

    let heard = "";
    try {
      const onUsage = makeOnUsage(deps.db, {
        userId,
        platform: platformFromHeader(c.req.header("X-Client-Platform")),
      });
      const res = await deps.transcribe({
        audioBuffer,
        languageCode: row.language,
        onUsage,
      });
      heard = res.text;
    } catch {
      // AUDIO_SILENT / STT failure → treat as an incorrect attempt.
      heard = "";
    }

    const correct = isPronunciationCorrect(heard, row.term);
    const mastery = correct ? Math.min(row.mastery + 1, MAX_MASTERY) : 0;
    const updated = await deps.db
      .update(vocabItems)
      .set({ mastery })
      .where(and(eq(vocabItems.id, id), eq(vocabItems.userId, userId)))
      .returning();

    return c.json({ correct, heard, item: updated[0] });
  });

  // DELETE /v1/vocab/:id — remove from deck.
  routes.delete("/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    const deleted = await deps.db
      .delete(vocabItems)
      .where(and(eq(vocabItems.id, id), eq(vocabItems.userId, userId)))
      .returning();
    if (deleted.length === 0) {
      return c.json({ error: { code: "NOT_FOUND" } }, 404);
    }
    return c.json({ ok: true });
  });

  return routes;
}
