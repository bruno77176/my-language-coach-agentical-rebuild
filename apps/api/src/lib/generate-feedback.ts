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
- corrections (0-3 items): clear mistakes the STUDENT made. Each: { you_said, better, explanation }. "you_said" is what the student actually said; "better" is the corrected form; "explanation" is one short sentence in the student's native language.
- vocab (0-8 items): new or interesting words / expressions worth remembering. Prefer items from the student's speech but include 1-2 from the coach if the student likely doesn't know them. Each: { term, translation, source_phrase, article }. "source_phrase" is the sentence from the transcript where the term appeared (so it can be reviewed in context). "article" is the singular DEFINITE article that marks the noun's gender in the target language (e.g. der/die/das, le/la, el/la, il/lo/la, o/a); use null when the term is not a gendered noun or the target language does not mark gender on its articles (e.g. English).

Rules:
- If uncertain about a grammar rule, omit the correction rather than fabricate.
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
