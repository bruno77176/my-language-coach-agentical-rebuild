import type OpenAI from "openai";
import {
  CoachMemorySchema,
  type CoachMemory,
  LANGUAGES,
} from "@language-coach/shared";
import type { OnUsage } from "../providers/usage";
import { reportError } from "./sentry";

export type TranscriptTurn = {
  role: "user" | "coach";
  text: string;
};

export type ExtractMemoryInput = {
  existingMemory: CoachMemory;
  transcript: TranscriptTurn[];
  languageCode: string;
  model?: string;
  onUsage?: OnUsage;
};

const SYSTEM_PROMPT = `You update a structured language-learner profile based on a new conversation.

You receive:
1. The student's CURRENT memory (JSON conforming to the schema below).
2. A NEW conversation transcript between the student and their coach.

You output ONLY a JSON object matching this EXACT schema:
{
  "proficiency_level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | null,
  "recent_topics": [
    { "topic": "<short topic name>", "last_practiced_at": "<ISO 8601 UTC>" }
  ],
  "weak_areas": ["<short grammar or vocab pattern the student struggles with>"],
  "personal_context": {
    "hobbies": ["<string>"],
    "job": "<string>",
    "family": "<string>",
    "location": "<string>",
    "motivations": ["<string>"]
  },
  "last_session_summary": "<one short sentence summarizing THIS conversation>" | null
}

Rules:
- ALWAYS write recent_topics as an array of OBJECTS with "topic" and "last_practiced_at" — never plain strings.
- Merge new topics into the existing recent_topics array. Keep up to 20, most recent last.
- last_practiced_at MUST be a strict ISO 8601 UTC timestamp, e.g. "2026-05-30T10:00:00.000Z".
- For fields under personal_context, OMIT keys that aren't established — do not write empty strings or empty arrays.
- If a field is unchanged from current memory, return its existing value verbatim.
- Never invent personal facts the student did not say in the transcript.
- last_session_summary should be filled in for every transcript (one short sentence about what was discussed).
- Output ONLY the JSON object — no markdown fences, no commentary.`;

export async function extractMemory(
  client: OpenAI,
  input: ExtractMemoryInput,
): Promise<CoachMemory | null> {
  const lang = LANGUAGES.find((l) => l.code === input.languageCode);
  const langName = lang?.englishName ?? input.languageCode;
  const transcriptText = input.transcript
    .map((t) => `${t.role.toUpperCase()}: ${t.text}`)
    .join("\n");
  const userPrompt = `Language: ${langName}

CURRENT MEMORY:
${JSON.stringify(input.existingMemory, null, 2)}

NEW TRANSCRIPT:
${transcriptText}

Return the updated memory JSON:`;

  let completion;
  try {
    completion = await client.chat.completions.create({
      model: input.model ?? "gpt-4o-mini",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });
  } catch (err) {
    reportError(err, { where: "extract-memory.api" });
    return null;
  }

  if (input.onUsage && completion.usage) {
    void Promise.resolve(
      input.onUsage({
        provider: "openai",
        operation: `chat:${input.model ?? "gpt-4o-mini"}`,
        inputTokens: completion.usage.prompt_tokens,
        outputTokens: completion.usage.completion_tokens,
      }),
    ).catch(() => {});
  }

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const validated = CoachMemorySchema.parse(parsed);
    return validated;
  } catch (err) {
    reportError(err, { where: "extract-memory.parse" });
    return null;
  }
}
