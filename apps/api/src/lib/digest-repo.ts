import type OpenAI from "openai";
import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { memoryItems } from "../db/schema";
import { extractMemoryItems } from "./extract-memory-items";
import { embedTexts } from "./embed-texts";
import type { TranscriptTurn } from "./extract-memory";
import type { RunDigestDeps } from "./run-digest";
import type { MemoryItemType } from "@language-coach/shared";
import type { OnUsage } from "../providers/usage";

export function makeDigestDeps(
  db: Database,
  openai: OpenAI,
  job: { userId: string; conversationId: string; languageCode: string },
  onUsage?: OnUsage,
): RunDigestDeps {
  const { userId, conversationId, languageCode } = job;

  return {
    extractItems: (transcript, lang) =>
      extractMemoryItems(openai, { transcript, languageCode: lang, onUsage }),
    embed: (texts) => embedTexts(openai, texts, { onUsage }),
    getActiveItems: async () => {
      const rows = await db.query.memoryItems.findMany({
        where: (t, { eq: e, and: a }) =>
          a(
            e(t.userId, userId),
            e(t.languageCode, languageCode),
            e(t.status, "active"),
          ),
      });
      return rows.map((r) => ({
        id: r.id,
        type: r.type as MemoryItemType,
        embedding: r.embedding ?? null,
        salience: r.salience,
      }));
    },
    insertItem: async (item) => {
      const sr =
        item.type === "mistake"
          ? {
              dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              srIntervalDays: 1,
              srEase: 2.5,
            }
          : {};
      await db.insert(memoryItems).values({
        userId,
        languageCode,
        type: item.type,
        content: item.content,
        embedding: item.embedding,
        sourceConversationId: conversationId,
        ...sr,
      });
    },
    bumpItem: async (id, newSalience) => {
      await db
        .update(memoryItems)
        .set({
          salience: newSalience,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(memoryItems.id, id));
    },
  };
}

export async function loadTranscript(
  db: Database,
  conversationId: string,
): Promise<TranscriptTurn[]> {
  const messages = await db.query.messages.findMany({
    where: (t, { eq: e }) => e(t.conversationId, conversationId),
    orderBy: (t, { asc: a }) => [a(t.createdAt)],
  });
  return messages.map((m) => ({
    role: (m.role === "coach" ? "coach" : "user") as "coach" | "user",
    text: m.text,
  }));
}
