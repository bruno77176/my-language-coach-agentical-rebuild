import type OpenAI from "openai";
import {
  SessionFeedbackSchema,
  type SessionFeedback,
  LANGUAGES,
} from "@language-coach/shared";
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

  const model = input.model ?? "gpt-4o";
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
    reportError(err, { where: "generate-feedback.api" });
    return null;
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

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return SessionFeedbackSchema.parse(parsed);
  } catch (err) {
    reportError(err, { where: "generate-feedback.parse" });
    return null;
  }
}
