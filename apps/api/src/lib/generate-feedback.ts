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

const SYSTEM_PROMPT = `You are a language-coaching feedback writer. You receive a transcript of a short conversation between a student and a coach.

You output ONLY a JSON object with three arrays:
- highlights (0-3 items): things the STUDENT said well. Each: { phrase, why }. "phrase" in the target language, "why" in the student's native language, max one sentence.
- corrections (0-4 items): the MOST IMPACTFUL mistakes the STUDENT made — prioritize errors that change the meaning, sound unnatural to a native, or recur, over tiny slips. Each: { you_said, better, explanation, rule?, example? }.
  - "you_said": what the student actually said, verbatim.
  - "better": the corrected form.
  - "explanation": 1-3 sentences in the student's native language. Actually TEACH: say what is wrong AND what the correct form does, concretely — not just "wrong tense".
  - "rule" (optional): the underlying grammar rule or pattern, one clear sentence in the student's native language. INCLUDE it whenever a real rule applies (conjugation, agreement, gender/article, word order, preposition/case, plural…). Omit only for pure typos / one-off slips.
  - "example" (optional): one more short, correct example in the TARGET language using the same pattern, so the student sees it generalize. Omit if it would just repeat "better".
- vocab (0-8 items): new or interesting words / expressions worth remembering. Prefer items from the student's speech but include 1-2 from the coach if the student likely doesn't know them. Each: { term, translation, source_phrase, article }. "source_phrase" is the sentence from the transcript where the term appeared (so it can be reviewed in context). "article" is the singular DEFINITE article that marks the noun's gender in the target language (e.g. der/die/das, le/la, el/la, il/lo/la, o/a); use null when the term is not a gendered noun or the target language does not mark gender on its articles (e.g. English).

Rules:
- LANGUAGE (critical): every EXPLANATION field — highlights.why, corrections.explanation, corrections.rule, and vocab.translation — must be written ENTIRELY in the student's native language (named in the user message). Do NOT write any of it in English, and do NOT mix languages within a field, unless the student's native language actually is English. Only the target-language fields stay in the target language: highlights.phrase, corrections.you_said, corrections.better, corrections.example, vocab.term, vocab.source_phrase.
- If uncertain about a grammar rule, omit the "rule" field (and the correction if you're unsure it's even wrong) rather than fabricate.
- The student's words come from imperfect speech-to-text: if something looks like a mishearing (a real word transcribed as a similar one, odd punctuation), do NOT report it as the student's mistake.
- All counts are UPPER BOUNDS. If there's nothing of substance to say in a category, return an empty array.
- Output ONLY the JSON object, no commentary, no markdown fences.`;

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
        { role: "system", content: SYSTEM_PROMPT },
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
