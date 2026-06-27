import type OpenAI from "openai";
import {
  LANGUAGES,
  MemoryItemCandidateListSchema,
  type MemoryItemCandidate,
} from "@language-coach/shared";
import type { TranscriptTurn } from "./extract-memory";
import type { OnUsage } from "../providers/usage";
import { reportError } from "./sentry";

export type ExtractItemsInput = {
  transcript: TranscriptTurn[];
  languageCode: string;
  model?: string;
  onUsage?: OnUsage;
};

const SYSTEM_PROMPT = `You extract durable, atomic memory items about a language learner from one conversation transcript.

Output ONLY JSON: {"items":[{"type": <one of: "fact"|"mistake"|"preference"|"goal"|"persona_detail">, "content": "<one short factual sentence>"}]}

Rules:
- One discrete fact per item. Keep "content" under ~120 characters.
- "mistake": a concrete language error the learner made (what they said vs the rule).
- "persona_detail": a stable personal fact they stated (family, job, location, life events).
- "preference"/"goal": how/why they want to learn.
- "fact": anything else durable worth remembering.
- Only include things the learner actually said. Never invent. If nothing durable, return {"items":[]}.
- No markdown, no commentary — JSON object only.`;

export async function extractMemoryItems(
  client: OpenAI,
  input: ExtractItemsInput,
): Promise<MemoryItemCandidate[]> {
  const lang = LANGUAGES.find((l) => l.code === input.languageCode);
  const langName = lang?.englishName ?? input.languageCode;
  const transcriptText = input.transcript
    .map((t) => `${t.role.toUpperCase()}: ${t.text}`)
    .join("\n");
  const model = input.model ?? "gpt-4o-mini";

  let completion;
  try {
    completion = await client.chat.completions.create({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Language: ${langName}\n\nTRANSCRIPT:\n${transcriptText}\n\nReturn the items JSON:`,
        },
      ],
    });
  } catch (err) {
    reportError(err, { where: "extract-memory-items.api" });
    return [];
  }

  if (input.onUsage && completion.usage) {
    void Promise.resolve(
      input.onUsage({
        provider: "openai",
        operation: `chat:${model}`,
        inputTokens: completion.usage.prompt_tokens,
        outputTokens: completion.usage.completion_tokens,
      }),
    ).catch(() => {});
  }

  const raw = completion.choices[0]?.message?.content;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { items?: unknown };
    return MemoryItemCandidateListSchema.parse(parsed.items ?? []);
  } catch (err) {
    reportError(err, { where: "extract-memory-items.parse" });
    return [];
  }
}
