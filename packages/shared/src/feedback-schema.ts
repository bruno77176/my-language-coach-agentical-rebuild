import { z } from "zod";

export const HighlightSchema = z.object({
  phrase: z.string().min(1).max(240),
  why: z.string().min(1).max(240),
});

export const CorrectionSchema = z.object({
  you_said: z.string().min(1).max(240),
  better: z.string().min(1).max(240),
  // Fuller "why" in the student's native language (raised from 280 → 600 so it
  // can actually teach, not just label the error).
  explanation: z.string().min(1).max(600),
  // The underlying grammar rule/pattern in one clear sentence (native language).
  // Optional — present whenever a rule applies (conjugation, agreement, word
  // order, preposition, article/gender…), omitted for pure typos/slips. Surfaced
  // behind a tap in the report.
  rule: z.string().max(400).optional(),
  // One more correct example in the target language using the same pattern, so
  // the student sees it generalize.
  example: z.string().max(240).optional(),
});

export const VocabItemSchema = z.object({
  term: z.string().min(1).max(120),
  translation: z.string().min(1).max(120),
  source_phrase: z.string().max(280).optional(),
  // Gender article for the deck (der/die/das, le/la…); null for non-nouns /
  // languages without gendered articles.
  article: z.string().max(16).nullable().optional(),
});

export const SessionFeedbackSchema = z
  .object({
    highlights: z.array(HighlightSchema).max(5),
    corrections: z.array(CorrectionSchema).max(5),
    vocab: z.array(VocabItemSchema).max(10),
  })
  .strict();

export type SessionFeedback = z.infer<typeof SessionFeedbackSchema>;
export type Highlight = z.infer<typeof HighlightSchema>;
export type Correction = z.infer<typeof CorrectionSchema>;
export type VocabItem = z.infer<typeof VocabItemSchema>;
