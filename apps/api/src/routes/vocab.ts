import { Hono } from "hono";
import { z } from "zod";
import { and, eq, type SQL } from "drizzle-orm";
import type { Database } from "../db";
import { vocabItems } from "../db/schema";
import type { OnUsage } from "../providers/usage";
import { makeOnUsage, platformFromHeader } from "../lib/usage-bridge";
import type { TranscribeInput, TranscribeResult } from "../providers/deepgram";
import { isPronunciationCorrect } from "../lib/vocab-match";
import { nextSchedule, masteryForBox } from "../lib/srs";

// Cards shown in a single daily review session (BRU-30): due reviews first,
// then new words fill up to this target.
const DAILY_REVIEW_TARGET = 15;

export type TranslateInput = {
  text: string;
  targetLanguageCode: string;
  onUsage?: OnUsage;
};
export type TranslateFn = (input: TranslateInput) => Promise<string>;
export type TranscribeFn = (
  input: TranscribeInput,
) => Promise<TranscribeResult>;
export type EnrichVocabInput = {
  term: string;
  sourceSentence?: string;
  languageCode: string;
  nativeLanguageCode: string;
  onUsage?: OnUsage;
};
export type EnrichVocabFn = (
  input: EnrichVocabInput,
) => Promise<{ translation: string | null; article: string | null }>;

export type VocabDeps = {
  db: Database;
  translate: TranslateFn;
  transcribe: TranscribeFn;
  // Optional: translate + recover the gender article in one LLM call. When
  // absent (e.g. in unit tests) the route falls back to translate-only.
  enrichVocab?: EnrichVocabFn;
};

const AddBody = z.object({
  language: z.string().min(2).max(8),
  term: z.string().min(1).max(120),
  translation: z.string().min(1).max(120).optional(),
  // The sentence the word was saved from (BRU-11) + its gender article
  // (BRU-31). Article is usually derived server-side, but accept a client hint.
  source_sentence: z.string().min(1).max(600).optional(),
  article: z.string().min(1).max(16).optional(),
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
      orderBy: (t, { asc: as, desc: de }) => [as(t.mastery), de(t.createdAt)],
    });
    const dueCount = items.filter((i) => i.mastery < MAX_MASTERY).length;
    const starredCount = items.filter((i) => i.starred).length;
    return c.json({ items, dueCount, starredCount });
  });

  // GET /v1/vocab/review/today?language=xx — the scheduled daily session
  // (BRU-30): up to DAILY_REVIEW_TARGET cards, due reviews first (oldest-due),
  // then new (never-introduced) words to fill the rest. Decks are small, so we
  // read the full due/new sets to also report accurate counts for the Home copy.
  routes.get("/review/today", async (c) => {
    const userId = c.get("userId");
    let language = c.req.query("language");
    if (!language) {
      const profile = await deps.db.query.profiles.findFirst({
        where: (t, { eq: e }) => e(t.userId, userId),
      });
      language = profile?.targetLang ?? "en";
    }
    const lang = language;
    const now = new Date();

    // Already-introduced words that have come due, oldest-due first.
    const dueAll = await deps.db.query.vocabItems.findMany({
      where: (t, { eq: e, and: a, isNotNull, lte }) =>
        a(
          e(t.userId, userId),
          e(t.language, lang),
          isNotNull(t.dueAt),
          lte(t.dueAt, now),
        ),
      orderBy: (t, { asc: as }) => [as(t.dueAt)],
    });
    // Never-introduced words, oldest-saved first.
    const newAll = await deps.db.query.vocabItems.findMany({
      where: (t, { eq: e, and: a, isNull }) =>
        a(e(t.userId, userId), e(t.language, lang), isNull(t.dueAt)),
      orderBy: (t, { asc: as }) => [as(t.createdAt)],
    });

    const dueQueue = dueAll.slice(0, DAILY_REVIEW_TARGET);
    const newQueue = newAll.slice(
      0,
      Math.max(0, DAILY_REVIEW_TARGET - dueQueue.length),
    );
    const items = [...dueQueue, ...newQueue];

    return c.json({
      items,
      dueCount: dueAll.length,
      newCount: newAll.length,
      // Total words still ahead overall (due + not-yet-introduced).
      remainingTotal: dueAll.length + newAll.length,
    });
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
    const sourceSentence = parsed.data.source_sentence ?? null;
    let translation: string | null = parsed.data.translation ?? null;
    let article: string | null = parsed.data.article ?? null;

    // Enrich missing fields (translation and/or gender article) in one call,
    // using the source sentence as context for accurate sense + gender.
    const needsTranslation = !translation;
    const needsArticle = !article;
    if (needsTranslation || needsArticle) {
      const profile = await deps.db.query.profiles.findFirst({
        where: (t, { eq: e }) => e(t.userId, userId),
      });
      const nativeLang = profile?.nativeLang ?? "en";
      const onUsage = makeOnUsage(deps.db, {
        userId,
        platform: platformFromHeader(c.req.header("X-Client-Platform")),
      });
      try {
        if (deps.enrichVocab) {
          const enriched = await deps.enrichVocab({
            term,
            sourceSentence: sourceSentence ?? undefined,
            languageCode: language,
            nativeLanguageCode: nativeLang,
            onUsage,
          });
          if (needsTranslation) translation = enriched.translation;
          if (needsArticle) article = enriched.article;
        } else if (needsTranslation) {
          // No enrichment dep wired — fall back to translate-only.
          translation = await deps.translate({
            text: term,
            targetLanguageCode: nativeLang,
            onUsage,
          });
        }
      } catch {
        // Best-effort: store whatever we already have if enrichment fails.
      }
    }

    const inserted = await deps.db
      .insert(vocabItems)
      .values({ userId, language, term, translation, sourceSentence, article })
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

    let set: Partial<typeof vocabItems.$inferInsert>;
    if ("result" in parsed.data) {
      // Apply the Leitner transition (single source of truth in srs.ts) and
      // mirror the legacy mastery counter so existing UI keeps working.
      const correct = parsed.data.result === "got_it";
      const { box, dueAt } = nextSchedule({
        box: row.srsBox,
        correct,
        now: new Date(),
      });
      set = {
        srsBox: box,
        dueAt,
        lastReviewedAt: new Date(),
        mastery: masteryForBox(box),
      };
    } else {
      set = { starred: parsed.data.starred };
    }

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
    // Advance the spaced-repetition schedule (same transition as the manual
    // got_it/still_learning path) and mirror the legacy mastery counter.
    const { box, dueAt } = nextSchedule({
      box: row.srsBox,
      correct,
      now: new Date(),
    });
    const updated = await deps.db
      .update(vocabItems)
      .set({
        srsBox: box,
        dueAt,
        lastReviewedAt: new Date(),
        mastery: masteryForBox(box),
      })
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
