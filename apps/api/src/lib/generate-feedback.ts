import type OpenAI from "openai";
import {
  SessionFeedbackSchema,
  HighlightSchema,
  CorrectionSchema,
  VocabItemSchema,
  type SessionFeedback,
  LANGUAGES,
} from "@language-coach/shared";
import type { z } from "zod";
import type { OnUsage } from "../providers/usage";
import type { TranscriptTurn } from "./extract-memory";
import { reportError } from "./sentry";

export type GenerateFeedbackInput = {
  transcript: TranscriptTurn[];
  languageCode: string;
  nativeLanguageCode: string;
  model?: string;
  onUsage?: OnUsage;
};

function buildSystemPrompt(nativeName: string, targetName: string): string {
  return `You are an expert, encouraging ${targetName} teacher writing a post-conversation feedback report for a student whose native language is ${nativeName}. Your job is to TEACH, not just label errors — every explanation should leave the student understanding WHY, the way a great private tutor would.

════════ ABSOLUTE LANGUAGE RULE ════════
The student is a ${nativeName} speaker. Write these fields ENTIRELY in ${nativeName}, never in ${targetName} and never in English:
  • highlights.why
  • corrections.explanation
  • corrections.rule
  • vocab.translation
Only these fields are in ${targetName} (the language being learned):
  • highlights.phrase, corrections.you_said, corrections.better, corrections.example, vocab.term, vocab.source_phrase
If you write any explanation/why/rule in ${targetName} or English, the report is WRONG. Double-check every explanatory sentence is in ${nativeName} before returning.
═════════════════════════════════════════

Output ONLY a JSON object with three arrays:

- highlights (0-3): things the STUDENT genuinely said well (natural phrasing, a correct tricky structure, good vocabulary). Each: { phrase, why }. "phrase" = their words in ${targetName}; "why" = one warm sentence in ${nativeName} explaining what was good.

- corrections (0-4): the MOST IMPACTFUL mistakes — prioritize errors that change meaning, sound clearly non-native, or recur, over tiny slips. Each: { you_said, better, explanation, rule?, example? }.
  • "you_said": what the student actually said, verbatim (in ${targetName}).
  • "better": the natural corrected version (in ${targetName}).
  • "explanation" (in ${nativeName}, 2-4 full sentences): actually TEACH. Name what kind of error it is, explain the underlying grammar clearly and concretely (which case/gender/tense/agreement/word-order and why THIS form is required here), and — when helpful — contrast it with the student's version so they see the difference. This is the heart of the report: be substantive and pedagogical, not a single terse line.
  • "rule" (in ${nativeName}, optional but STRONGLY preferred): the general, reusable grammar rule behind the correction, stated so the student can apply it next time (e.g. "Après la préposition « an » on utilise le datif : an + dem → am."). Include it whenever any real rule applies (case, gender/article, conjugation, agreement, word order, plural, preposition…). Omit only for pure typos.
  • "example" (in ${targetName}, optional): one MORE correct example sentence using the same pattern, so the rule generalizes beyond this one fix.

- vocab (0-8): useful words / expressions worth remembering — prefer the student's own speech, include 1-2 from the coach if likely new. Each: { term, translation, source_phrase, article }. "translation" in ${nativeName}; "source_phrase" is the ${targetName} sentence it appeared in; "article" is the singular DEFINITE article marking the noun's gender in ${targetName} (der/die/das, le/la, el/la, il/lo/la, o/a), or null for non-nouns / languages without gendered articles.

Rules:
- Be generous with corrections and their depth — a rich, specific report is the whole value. If the student made 3-4 real mistakes, return 3-4 well-explained corrections, not 1.
- If you're not sure something is actually wrong, or unsure of the rule, omit it rather than fabricate.
- The student's words come from imperfect speech-to-text: if a word looks like a mishearing (a plausible word mis-transcribed, odd punctuation), do NOT report it as their mistake.
- Counts are UPPER BOUNDS; return an empty array for a category with nothing of substance.
- Output ONLY the JSON object — no commentary, no markdown fences.`;
}

// Max string lengths per field, mirroring the shared Zod schema. We clamp
// overlong strings to these BEFORE validating so a chatty model doesn't cost the
// student their whole report over a few extra characters.
const MAX = {
  phrase: 240,
  why: 240,
  you_said: 240,
  better: 240,
  explanation: 600,
  rule: 400,
  example: 240,
  term: 120,
  translation: 120,
  source_phrase: 280,
  article: 16,
} as const;

function clampStr(v: unknown, max: number): unknown {
  return typeof v === "string" && v.length > max ? v.slice(0, max) : v;
}

/** Keep only the items in `arr` that individually validate (after clamping
 *  overlong strings), up to `cap`. A single malformed item no longer discards
 *  the whole report. */
function pickValid<T>(
  arr: unknown,
  schema: z.ZodType<T>,
  clamp: (item: Record<string, unknown>) => Record<string, unknown>,
  cap: number,
): T[] {
  if (!Array.isArray(arr)) return [];
  const out: T[] = [];
  for (const item of arr) {
    if (out.length >= cap) break;
    const candidate =
      item && typeof item === "object"
        ? clamp(item as Record<string, unknown>)
        : item;
    const res = schema.safeParse(candidate);
    if (res.success) out.push(res.data);
  }
  return out;
}

/**
 * Parse the model's JSON into validated feedback, repairing what we safely can:
 * strip markdown fences / prose around the object, clamp overlong strings, and
 * drop individual malformed items rather than failing the whole report. Returns
 * null only when there's genuinely nothing usable.
 */
export function parseFeedbackLenient(raw: string): SessionFeedback | null {
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    // Model wrapped the JSON in fences or prose — extract the outermost object.
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      obj = JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;

  // Fast path: already perfectly valid.
  const strict = SessionFeedbackSchema.safeParse(o);
  if (strict.success) return strict.data;

  // Repair path: rebuild only the three known arrays, item-by-item, clamping
  // overlong strings. This also absorbs extra top-level keys (which .strict()
  // would otherwise reject) since we never pass them through.
  const candidate = {
    highlights: pickValid(
      o.highlights,
      HighlightSchema,
      (h) => ({
        ...h,
        phrase: clampStr(h.phrase, MAX.phrase),
        why: clampStr(h.why, MAX.why),
      }),
      5,
    ),
    corrections: pickValid(
      o.corrections,
      CorrectionSchema,
      (c) => ({
        ...c,
        you_said: clampStr(c.you_said, MAX.you_said),
        better: clampStr(c.better, MAX.better),
        explanation: clampStr(c.explanation, MAX.explanation),
        rule: clampStr(c.rule, MAX.rule),
        example: clampStr(c.example, MAX.example),
      }),
      5,
    ),
    vocab: pickValid(
      o.vocab,
      VocabItemSchema,
      (v) => ({
        ...v,
        term: clampStr(v.term, MAX.term),
        translation: clampStr(v.translation, MAX.translation),
        source_phrase: clampStr(v.source_phrase, MAX.source_phrase),
        article: clampStr(v.article, MAX.article),
      }),
      10,
    ),
  };
  const res = SessionFeedbackSchema.safeParse(candidate);
  return res.success ? res.data : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function generateFeedback(
  client: OpenAI,
  input: GenerateFeedbackInput,
): Promise<SessionFeedback | null> {
  const target =
    LANGUAGES.find((l) => l.code === input.languageCode)?.englishName ??
    input.languageCode;
  const native =
    LANGUAGES.find((l) => l.code === input.nativeLanguageCode)?.englishName ??
    input.nativeLanguageCode;
  const transcriptText = input.transcript
    .map((t) => `${t.role.toUpperCase()}: ${t.text}`)
    .join("\n");
  const userPrompt = `Target language: ${target}
Student's native language: ${native}

TRANSCRIPT:
${transcriptText}

Return the feedback JSON:`;

  const primary = input.model ?? "gpt-4o";
  // Feedback is the product's most valued output, so a single transient hiccup
  // (5xx/timeout/rate-limit), a one-off refusal/empty completion, or flaky JSON
  // must NOT permanently mark the session "failed". Retry the same model, then
  // fall back to gpt-4o-mini on the last attempt. Historically there was no
  // retry at all and any of these silently nuked the whole report.
  const attempts = [primary, primary, "gpt-4o-mini"];

  for (let i = 0; i < attempts.length; i++) {
    const model = attempts[i]!;
    let completion;
    try {
      completion = await client.chat.completions.create({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildSystemPrompt(native, target) },
          { role: "user", content: userPrompt },
        ],
      });
    } catch (err) {
      reportError(err, {
        where: "generate-feedback.api",
        attempt: i + 1,
        model,
      });
      if (i < attempts.length - 1) await sleep(300 * (i + 1));
      continue;
    }

    if (input.onUsage && completion.usage) {
      void Promise.resolve(
        input.onUsage({
          provider: "openai",
          // Use chat:${model} namespace so cost-recording resolves the existing
          // chat rate card (same lesson as extract-memory). Per Task 3 review.
          operation: `chat:${model}`,
          inputTokens: completion.usage.prompt_tokens,
          outputTokens: completion.usage.completion_tokens,
        }),
      ).catch(() => {});
    }

    const message = completion.choices[0]?.message;
    const raw = message?.content;
    if (!raw) {
      // content === null usually means a model refusal (message.refusal is set)
      // or an empty completion. This path used to return null SILENTLY — no
      // Sentry breadcrumb — which is why these failures were undiagnosable.
      reportError(new Error("feedback: empty/refusal completion"), {
        where: "generate-feedback.empty",
        attempt: i + 1,
        model,
        refusal: message?.refusal ?? null,
        finishReason: completion.choices[0]?.finish_reason ?? null,
      });
      if (i < attempts.length - 1) await sleep(300 * (i + 1));
      continue;
    }

    const parsed = parseFeedbackLenient(raw);
    if (parsed) return parsed;

    reportError(new Error("feedback: unparseable model output"), {
      where: "generate-feedback.parse",
      attempt: i + 1,
      model,
      rawSnippet: raw.slice(0, 800),
    });
    if (i < attempts.length - 1) await sleep(300 * (i + 1));
  }

  return null;
}
