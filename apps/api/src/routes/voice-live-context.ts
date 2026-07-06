import type { Database } from "../db";
import {
  buildCoachSystemPrompt,
  parseCoachMemoryRow,
  ROLE_PLAY_SCENARIOS,
} from "@language-coach/shared";
import type { ChatMessage } from "../providers/openai";
import type { LiveTurnContext } from "./voice-live";

const MAX_HISTORY_MESSAGES = 20;

// Production loader for a Live connection's seed context: verifies the
// conversation belongs to the caller, then builds the system prompt (with
// memory + scenario, same as the SSE turn route) plus the recent history. The
// connection appends live turns on top of this base.
export function makeLoadContext(db: Database) {
  return async (
    userId: string,
    conversationId: string,
  ): Promise<LiveTurnContext | null> => {
    const conversation = await db.query.conversations.findFirst({
      where: (t, { eq, and }) =>
        and(eq(t.id, conversationId), eq(t.userId, userId)),
    });
    if (!conversation) return null;

    const [profile, memoryRow, history] = await Promise.all([
      db.query.profiles.findFirst({
        where: (t, { eq }) => eq(t.userId, userId),
      }),
      db.query.coachMemory.findFirst({
        where: (t, { eq, and }) =>
          and(eq(t.userId, userId), eq(t.languageCode, conversation.language)),
      }),
      db.query.messages.findMany({
        where: (t, { eq }) => eq(t.conversationId, conversationId),
        orderBy: (t, { asc }) => [asc(t.createdAt)],
      }),
    ]);
    if (!profile) return null;

    const memory =
      memoryRow && profile.memoryEnabled
        ? parseCoachMemoryRow(memoryRow)
        : null;
    const scenario = conversation.scenarioId
      ? (ROLE_PLAY_SCENARIOS.find((s) => s.id === conversation.scenarioId) ??
        null)
      : null;
    const sysPrompt = buildCoachSystemPrompt({
      targetLanguage: conversation.language,
      userDisplayName: profile.displayName,
      nativeLanguage: profile.nativeLang,
      memory,
      memoryDepth: "basic",
      scenario: scenario
        ? {
            id: scenario.id,
            systemPromptFragment: scenario.systemPromptFragment,
          }
        : null,
    });

    const recent = history.slice(-MAX_HISTORY_MESSAGES);
    const baseMessages: ChatMessage[] = [
      { role: "system", content: sysPrompt },
      ...recent.map((m) => ({
        role: (m.role === "coach" ? "assistant" : m.role) as
          | "user"
          | "assistant"
          | "system",
        content: m.text,
      })),
    ];

    return { languageCode: conversation.language, baseMessages };
  };
}
