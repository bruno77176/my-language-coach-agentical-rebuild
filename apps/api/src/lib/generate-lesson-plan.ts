import type OpenAI from "openai";
import {
  LANGUAGES,
  LessonPlanSchema,
  type LessonPlan,
} from "@language-coach/shared";
import type { OnUsage } from "../providers/usage";
import { reportError } from "./sentry";

export type GenerateLessonPlanInput = {
  items: { type: string; content: string }[];
  proficiencyLevel: string | null;
  languageCode: string;
  model?: string;
  onUsage?: OnUsage;
};

const SYSTEM_PROMPT = `You are a language coaching assistant. Given a learner's memory items and proficiency level, produce a short next-lesson plan as JSON.

Output ONLY JSON with exactly this shape:
{"focus": "<one sentence describing the main focus of the next lesson>", "target_structures": ["<grammar or vocabulary structure to practice>", ...], "suggested_topics": ["<conversation topic>", ...], "callbacks": ["<personal detail to naturally reference>", ...]}

Rules:
- "focus": a single concise sentence describing the priority for the next lesson.
- "target_structures": 1-3 grammar or vocabulary structures to practice (drawn from their mistakes or goals). May be [].
- "suggested_topics": 1-3 conversation topics that would interest this learner. May be [].
- "callbacks": 0-3 personal details from their memory that can be naturally woven into conversation. May be [].
- Base everything on the provided memory items. Never invent facts not present in the items.
- No markdown, no commentary — JSON object only.`;

export async function generateLessonPlan(
  client: OpenAI,
  input: GenerateLessonPlanInput,
): Promise<LessonPlan | null> {
  const lang = LANGUAGES.find((l) => l.code === input.languageCode);
  const langName = lang?.englishName ?? input.languageCode;
  const model = input.model ?? "gpt-4o-mini";

  const itemsSummary =
    input.items.length > 0
      ? input.items.map((item) => `[${item.type}] ${item.content}`).join("\n")
      : "(no memory items yet)";

  const proficiency = input.proficiencyLevel ?? "unknown";

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
          content: `Target language: ${langName}\nLearner proficiency: ${proficiency}\n\nMemory items:\n${itemsSummary}\n\nReturn the lesson plan JSON:`,
        },
      ],
    });
  } catch (err) {
    reportError(err, { where: "generate-lesson-plan.api" });
    return null;
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
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return LessonPlanSchema.parse(parsed);
  } catch (err) {
    reportError(err, { where: "generate-lesson-plan.parse" });
    return null;
  }
}
