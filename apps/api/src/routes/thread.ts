import { conversations } from "../db/schema";
import type { Database } from "../db";

// Continuous-conversation thread helpers. A "thread" is the single persistent
// free-form conversation per (user, language): conversations row with
// kind='thread', scenario_id NULL, ended_at NULL forever. See migration 0021.

export type ResolvedThread = {
  conversationId: string;
  startedAt: Date;
  isNew: boolean;
};

const threadWhere =
  (userId: string, language: string) =>
  (
    t: { userId: unknown; language: unknown; kind: unknown },
    ops: {
      eq: (a: unknown, b: unknown) => unknown;
      and: (...xs: unknown[]) => unknown;
    },
  ) =>
    ops.and(
      ops.eq(t.userId, userId),
      ops.eq(t.language, language),
      ops.eq(t.kind, "thread"),
    );

/**
 * Find the user's thread for a language, creating it on first use. Guards the
 * unique-index race (two concurrent opens): on insert conflict, re-select.
 */
export async function resolveThread(
  db: Database,
  userId: string,
  language: string,
): Promise<ResolvedThread> {
  const found = await db.query.conversations.findFirst({
    where: threadWhere(userId, language) as never,
  });
  if (found) {
    return {
      conversationId: found.id,
      startedAt: found.startedAt,
      isNew: false,
    };
  }
  try {
    const inserted = await db
      .insert(conversations)
      .values({ userId, language, kind: "thread" })
      .returning({ id: conversations.id, startedAt: conversations.startedAt });
    return {
      conversationId: inserted[0]!.id,
      startedAt: inserted[0]!.startedAt,
      isNew: true,
    };
  } catch {
    // Lost the create race against the partial unique index — re-select.
    const row = await db.query.conversations.findFirst({
      where: threadWhere(userId, language) as never,
    });
    if (!row) throw new Error("thread resolution failed");
    return { conversationId: row.id, startedAt: row.startedAt, isNew: false };
  }
}

export type ThreadMessage = {
  id: string;
  role: "user" | "coach";
  text: string;
  translation: string | null;
  isGreeting: boolean;
  createdAt: Date;
};

/**
 * Load a page of a thread's messages newest-first internally, returned oldest→newest
 * for direct rendering. `before` (exclusive) drives "load earlier" pagination.
 * `hasMore` signals another older page exists.
 */
export async function loadThreadMessages(
  db: Database,
  conversationId: string,
  opts: { limit: number; before?: Date },
): Promise<{ messages: ThreadMessage[]; hasMore: boolean }> {
  const rows = await db.query.messages.findMany({
    where: (t, { eq: e, and: a, lt }) =>
      opts.before
        ? a(e(t.conversationId, conversationId), lt(t.createdAt, opts.before))
        : e(t.conversationId, conversationId),
    orderBy: (t, { desc: d }) => [d(t.createdAt)],
    limit: opts.limit + 1,
  });
  const hasMore = rows.length > opts.limit;
  const page = (hasMore ? rows.slice(0, opts.limit) : rows).slice().reverse();
  return {
    messages: page.map((m) => ({
      id: m.id,
      role: m.role,
      text: m.text,
      translation: m.translation,
      isGreeting: m.isGreeting,
      createdAt: m.createdAt,
    })),
    hasMore,
  };
}
