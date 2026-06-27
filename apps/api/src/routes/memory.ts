import { Hono } from "hono";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { Database } from "../db";
import { coachMemory, memoryItems, profiles } from "../db/schema";
import {
  CoachMemorySchema,
  LANGUAGES,
  type CoachMemory,
} from "@language-coach/shared";

export type MemoryDeps = { db: Database };

const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as [string, ...string[]];

// Consent is global: one flag per user governs memory for every language.
const ConsentBody = z.object({
  enabled: z.boolean(),
});

const UpdateBody = z.object({
  language_code: z.enum(LANGUAGE_CODES),
  memory: CoachMemorySchema,
});

export function createMemoryRoutes(deps: MemoryDeps) {
  const routes = new Hono<{ Variables: { userId: string } }>();

  // GET /v1/memory - global consent flag + all memories for the user
  routes.get("/", async (c) => {
    const userId = c.get("userId");
    const profile = await deps.db.query.profiles.findFirst({
      where: (t, { eq: e }) => e(t.userId, userId),
    });
    const rows = await deps.db.query.coachMemory.findMany({
      where: (t, { eq: e }) => e(t.userId, userId),
    });
    return c.json({
      memory_enabled: profile?.memoryEnabled ?? true,
      memories: rows.map((r) => ({
        language_code: r.languageCode,
        memory: {
          proficiency_level: r.proficiencyLevel as
            | CoachMemory["proficiency_level"]
            | null,
          recent_topics: r.recentTopics as CoachMemory["recent_topics"],
          weak_areas: r.weakAreas as CoachMemory["weak_areas"],
          personal_context:
            r.personalContext as CoachMemory["personal_context"],
          last_session_summary: r.lastSessionSummary,
        } satisfies CoachMemory,
        updated_at: r.updatedAt,
      })),
    });
  });

  // PUT /v1/memory/consent — global opt in/out for coach memory
  routes.put("/consent", async (c) => {
    const userId = c.get("userId");
    const body = await c.req.json().catch(() => ({}));
    const parsed = ConsentBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: parsed.error.message } },
        400,
      );
    }
    await deps.db
      .update(profiles)
      .set({ memoryEnabled: parsed.data.enabled })
      .where(eq(profiles.userId, userId));
    return c.json({ ok: true });
  });

  // PUT /v1/memory  — user-edited memory
  routes.put("/", async (c) => {
    const userId = c.get("userId");
    const body = await c.req.json().catch(() => ({}));
    const parsed = UpdateBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: parsed.error.message } },
        400,
      );
    }
    // Reject edits while memory is globally disabled — re-enable consent first.
    const profile = await deps.db.query.profiles.findFirst({
      where: (t, { eq: e }) => e(t.userId, userId),
    });
    if (profile && !profile.memoryEnabled) {
      return c.json(
        {
          error: {
            code: "OPTED_OUT",
            message: "Memory is disabled. Re-enable it before editing.",
          },
        },
        409,
      );
    }
    const m = parsed.data.memory;
    await deps.db
      .insert(coachMemory)
      .values({
        userId,
        languageCode: parsed.data.language_code,
        proficiencyLevel: m.proficiency_level ?? null,
        recentTopics: m.recent_topics,
        weakAreas: m.weak_areas,
        personalContext: m.personal_context,
        lastSessionSummary: m.last_session_summary ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [coachMemory.userId, coachMemory.languageCode],
        set: {
          proficiencyLevel: m.proficiency_level ?? null,
          recentTopics: m.recent_topics,
          weakAreas: m.weak_areas,
          personalContext: m.personal_context,
          lastSessionSummary: m.last_session_summary ?? null,
          updatedAt: new Date(),
        },
      });
    return c.json({ ok: true });
  });

  // GET /v1/memory/items?language_code=xx — the user's active memory items
  routes.get("/items", async (c) => {
    const userId = c.get("userId");
    const lang = c.req.query("language_code");
    const rows = await deps.db.query.memoryItems.findMany({
      where: (t, { eq: e, and: a }) =>
        lang
          ? a(
              e(t.userId, userId),
              e(t.status, "active"),
              e(t.languageCode, lang),
            )
          : a(e(t.userId, userId), e(t.status, "active")),
      orderBy: (t, { desc: d }) => [d(t.salience), d(t.lastSeenAt)],
    });
    return c.json({
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        content: r.content,
        language_code: r.languageCode,
        created_at: r.createdAt,
      })),
    });
  });

  // DELETE /v1/memory/items/:id — delete one item (ownership-scoped)
  routes.delete("/items/:id", async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    await deps.db
      .delete(memoryItems)
      .where(and(eq(memoryItems.id, id), eq(memoryItems.userId, userId)));
    return c.json({ ok: true });
  });

  // DELETE /v1/memory/:languageCode
  routes.delete("/:languageCode", async (c) => {
    const userId = c.get("userId");
    const languageCode = c.req.param("languageCode");
    if (!LANGUAGE_CODES.includes(languageCode)) {
      return c.json(
        { error: { code: "BAD_REQUEST", message: "Unknown language" } },
        400,
      );
    }
    await deps.db
      .delete(coachMemory)
      .where(
        and(
          eq(coachMemory.userId, userId),
          eq(coachMemory.languageCode, languageCode),
        ),
      );
    await deps.db
      .delete(memoryItems)
      .where(
        and(
          eq(memoryItems.userId, userId),
          eq(memoryItems.languageCode, languageCode),
        ),
      );
    return c.json({ ok: true });
  });

  return routes;
}
