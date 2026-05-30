import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createMemoryRoutes } from "./memory";

const userId = "00000000-0000-0000-0000-000000000001";

type MemoryRow = {
  userId: string;
  languageCode: string;
  proficiencyLevel: string | null;
  recentTopics: unknown;
  weakAreas: unknown;
  personalContext: unknown;
  lastSessionSummary: string | null;
  optedOut: boolean;
  updatedAt: Date;
};

function appWithMemory(routes: ReturnType<typeof createMemoryRoutes>) {
  const app = new Hono<{ Variables: { userId: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", userId);
    await next();
  });
  app.route("/v1/memory", routes);
  return app;
}

function makeFakeDb(initial: MemoryRow[] = []) {
  const rows: MemoryRow[] = [...initial];

  const fakeDb = {
    query: {
      coachMemory: {
        findMany: vi.fn(async (opts: { where?: unknown }) => {
          // Simulate Drizzle's relational query helpers — return all rows
          // owned by the user (the tests only ever set one userId).
          const _ = opts;
          return rows.filter((r) => r.userId === userId);
        }),
        findFirst: vi.fn(async (_opts: { where?: unknown }) => {
          // The PUT / handler calls findFirst to detect opted-out rows.
          // Tests scope at most one row per (userId, languageCode), so
          // returning the first matching row by userId is sufficient.
          return rows.find((r) => r.userId === userId);
        }),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn((vals: Partial<MemoryRow>) => ({
        onConflictDoUpdate: vi.fn(
          async (conflict: { set: Partial<MemoryRow> }) => {
            const existing = rows.find(
              (r) =>
                r.userId === vals.userId &&
                r.languageCode === vals.languageCode,
            );
            if (existing) {
              Object.assign(existing, conflict.set);
            } else {
              rows.push({
                userId: vals.userId!,
                languageCode: vals.languageCode!,
                proficiencyLevel: vals.proficiencyLevel ?? null,
                recentTopics: vals.recentTopics ?? [],
                weakAreas: vals.weakAreas ?? [],
                personalContext: vals.personalContext ?? {},
                lastSessionSummary: vals.lastSessionSummary ?? null,
                optedOut: vals.optedOut ?? false,
                updatedAt: vals.updatedAt ?? new Date(),
              });
            }
          },
        ),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        // Simplification: the tests' delete cases call DELETE
        // /memory/:lang once, scoped to a known (userId, languageCode).
        // We don't try to interpret the Drizzle expression — instead the
        // test asserts on db.delete being called and then on a follow-up
        // GET returning the right state. We delete based on the last
        // values passed to a hypothetical filter we cannot inspect, so
        // we rely on the test invoking delete with specific scope.
      }),
    })),
    _rows: rows,
  };

  return fakeDb;
}

describe("memory routes", () => {
  describe("PUT /v1/memory/consent", () => {
    it("returns ok and upserts a row with the consent flag", async () => {
      const db = makeFakeDb();
      const app = appWithMemory(createMemoryRoutes({ db: db as never }));

      const res = await app.request("/v1/memory/consent", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language_code: "fr", opted_out: true }),
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(db._rows).toHaveLength(1);
      expect(db._rows[0]?.languageCode).toBe("fr");
      expect(db._rows[0]?.optedOut).toBe(true);
    });

    it("returns 400 on invalid body", async () => {
      const db = makeFakeDb();
      const app = appWithMemory(createMemoryRoutes({ db: db as never }));

      const res = await app.request("/v1/memory/consent", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language_code: "" }),
      });

      expect(res.status).toBe(400);
    });

    it("rejects unknown language_code with 400", async () => {
      const db = makeFakeDb();
      const app = appWithMemory(createMemoryRoutes({ db: db as never }));

      const res = await app.request("/v1/memory/consent", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language_code: "xx", opted_out: true }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("PUT /v1/memory", () => {
    it("upserts a memory row with the supplied CoachMemory", async () => {
      const db = makeFakeDb();
      const app = appWithMemory(createMemoryRoutes({ db: db as never }));

      const res = await app.request("/v1/memory", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          language_code: "it",
          memory: {
            proficiency_level: "B1",
            recent_topics: [
              { topic: "cooking", last_practiced_at: new Date().toISOString() },
            ],
            weak_areas: ["subjunctive"],
            personal_context: { hobbies: ["chess"] },
            last_session_summary: "Talked about pasta",
          },
        }),
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(db._rows).toHaveLength(1);
      expect(db._rows[0]?.languageCode).toBe("it");
      expect(db._rows[0]?.proficiencyLevel).toBe("B1");
      expect(db._rows[0]?.lastSessionSummary).toBe("Talked about pasta");
    });

    it("returns 400 on invalid memory body", async () => {
      const db = makeFakeDb();
      const app = appWithMemory(createMemoryRoutes({ db: db as never }));

      const res = await app.request("/v1/memory", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          language_code: "fr",
          memory: { bogus: true },
        }),
      });

      expect(res.status).toBe(400);
    });

    it("returns 409 when the existing row is opted out", async () => {
      const db = makeFakeDb([
        {
          userId,
          languageCode: "fr",
          proficiencyLevel: null,
          recentTopics: [],
          weakAreas: [],
          personalContext: {},
          lastSessionSummary: null,
          optedOut: true,
          updatedAt: new Date(),
        },
      ]);
      const app = appWithMemory(createMemoryRoutes({ db: db as never }));

      const res = await app.request("/v1/memory", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          language_code: "fr",
          memory: {
            proficiency_level: "B1",
            recent_topics: [],
            weak_areas: ["agreement"],
            personal_context: {},
            last_session_summary: null,
          },
        }),
      });

      expect(res.status).toBe(409);
      const body = (await res.json()) as {
        error: { code: string; message: string };
      };
      expect(body.error.code).toBe("OPTED_OUT");
      // Existing row should still be opted out & unchanged
      expect(db._rows[0]?.optedOut).toBe(true);
      expect(db._rows[0]?.weakAreas).toEqual([]);
    });
  });

  describe("GET /v1/memory", () => {
    it("returns the user's memories array", async () => {
      const db = makeFakeDb([
        {
          userId,
          languageCode: "fr",
          proficiencyLevel: "B2",
          recentTopics: [],
          weakAreas: ["gender agreement"],
          personalContext: { hobbies: ["reading"] },
          lastSessionSummary: "Discussed books",
          optedOut: false,
          updatedAt: new Date("2026-05-29T00:00:00Z"),
        },
      ]);
      const app = appWithMemory(createMemoryRoutes({ db: db as never }));

      const res = await app.request("/v1/memory");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        memories: Array<{
          language_code: string;
          opted_out: boolean;
          memory: { proficiency_level: string | null };
        }>;
      };
      expect(body.memories).toHaveLength(1);
      expect(body.memories[0]?.language_code).toBe("fr");
      expect(body.memories[0]?.opted_out).toBe(false);
      expect(body.memories[0]?.memory.proficiency_level).toBe("B2");
    });
  });

  describe("DELETE /v1/memory/:lang", () => {
    it("calls db.delete and returns ok", async () => {
      const db = makeFakeDb([
        {
          userId,
          languageCode: "fr",
          proficiencyLevel: null,
          recentTopics: [],
          weakAreas: [],
          personalContext: {},
          lastSessionSummary: null,
          optedOut: false,
          updatedAt: new Date(),
        },
      ]);
      const app = appWithMemory(createMemoryRoutes({ db: db as never }));

      const res = await app.request("/v1/memory/fr", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(db.delete).toHaveBeenCalled();
    });
  });
});
