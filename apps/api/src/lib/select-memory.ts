import type { Database } from "../db";
import type { MemoryItemType } from "@language-coach/shared";

export async function selectMemoryForPrompt(
  db: Database,
  input: { userId: string; languageCode: string; limit?: number },
): Promise<{ type: MemoryItemType; content: string }[]> {
  const rows = await db.query.memoryItems.findMany({
    where: (t, { eq, and }) =>
      and(
        eq(t.userId, input.userId),
        eq(t.languageCode, input.languageCode),
        eq(t.status, "active"),
      ),
    orderBy: (t, { desc: d }) => [d(t.salience), d(t.lastSeenAt)],
    limit: input.limit ?? 8,
  });
  return rows.map((r) => ({
    type: r.type as MemoryItemType,
    content: r.content,
  }));
}
