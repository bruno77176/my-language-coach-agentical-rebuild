import type OpenAI from "openai";
import type { OnUsage } from "../providers/usage";
import { reportError } from "./sentry";

export type EmbedOpts = { model?: string; onUsage?: OnUsage };

export async function embedTexts(
  client: OpenAI,
  texts: string[],
  opts: EmbedOpts = {},
): Promise<(number[] | null)[]> {
  if (texts.length === 0) return [];
  const model = opts.model ?? "text-embedding-3-small";
  try {
    const res = await client.embeddings.create({ model, input: texts });
    const ordered = [...res.data].sort((a, b) => a.index - b.index);
    if (opts.onUsage && res.usage) {
      void Promise.resolve(
        opts.onUsage({
          provider: "openai",
          operation: `embed:${model}`,
          inputTokens: res.usage.prompt_tokens,
          outputTokens: 0,
        }),
      ).catch(() => {});
    }
    return ordered.map((d) => d.embedding as number[]);
  } catch (err) {
    reportError(err, { where: "embed-texts.api" });
    return texts.map(() => null);
  }
}
