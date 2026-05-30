import { Hono } from "hono";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { Database } from "../db";
import { coachMemory } from "../db/schema";
import {
  CoachMemorySchema,
  emptyCoachMemory,
  LANGUAGES,
  type CoachMemory,
} from "@language-coach/shared";

export type MemoryDeps = { db: Database };

const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as [string, ...string[]];

const ConsentBody = z.object({
  language_code: z.enum(LANGUAGE_CODES),
  opted_out: z.boolean(),
});

const UpdateBody = z.object({
  language_code: z.enum(LANGUAGE_CODES),
  memory: CoachMemorySchema,
});

export function createMemoryRoutes(deps: MemoryDeps) {
  const routes = new Hono<{ Variables: { userId: string } }>();

  // GET /v1/memory - list all memories for the user (across languages)
  routes.get("/", async (c) => {
    const userId = c.get("userId");
    const rows = await deps.db.query.coachMemory.findMany({
      where: (t, { eq: e }) => e(t.userId, userId),
    });
    return c.json({
      memories: rows.map((r) => ({
        language_code: r.languageCode,
        opted_out: r.optedOut,
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

  // PUT /v1/memory/consent
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
    const empty = emptyCoachMemory();
    await deps.db
      .insert(coachMemory)
      .values({
        userId,
        languageCode: parsed.data.language_code,
        optedOut: parsed.data.opted_out,
        recentTopics: empty.recent_topics,
        weakAreas: empty.weak_areas,
        personalContext: empty.personal_context,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [coachMemory.userId, coachMemory.languageCode],
        set: { optedOut: parsed.data.opted_out, updatedAt: new Date() },
      });
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
    // Reject writes to opted-out rows — the editor must re-enable consent first.
    const existing = await deps.db.query.coachMemory.findFirst({
      where: (t, { eq: e, and: a }) =>
        a(e(t.userId, userId), e(t.languageCode, parsed.data.language_code)),
    });
    if (existing?.optedOut) {
      return c.json(
        {
          error: {
            code: "OPTED_OUT",
            message:
              "Memory is disabled for this language. Re-enable it before editing.",
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
    return c.json({ ok: true });
  });

  return routes;
}
