import { describe, expect, it, vi, type Mock } from "vitest";
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
  updatedAt: Date;
};

type ProfileRow = { userId: string; memoryEnabled: boolean };

type MemoryItemRow = {
  id: string;
  userId: string;
  languageCode: string;
  type: string;
  content: string;
  salience: number;
  status: string;
  createdAt: Date;
  lastSeenAt: Date;
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

function makeFakeDb({
  memoryRows = [] as MemoryRow[],
  profile = { userId, memoryEnabled: true } as ProfileRow | undefined,
  memoryItemRows = [] as MemoryItemRow[],
} = {}) {
  const rows: MemoryRow[] = [...memoryRows];
  const profileRow: ProfileRow | undefined = profile
    ? { ...profile }
    : undefined;

  const fakeDb = {
    query: {
      coachMemory: {
        findMany: vi.fn(async (_opts: { where?: unknown }) =>
          rows.filter((r) => r.userId === userId),
        ),
        findFirst: vi.fn(async (_opts: { where?: unknown }) =>
          rows.find((r) => r.userId === userId),
        ),
      },
      profiles: {
        // Global consent flag lives on the profile now.
        findFirst: vi.fn(async (_opts: { where?: unknown }) => profileRow),
      },
      memoryItems: {
        findMany: vi.fn(
          async (_opts: { where?: unknown; orderBy?: unknown }) => [
            ...memoryItemRows,
          ],
        ),
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
                updatedAt: vals.updatedAt ?? new Date(),
              });
            }
          },
        ),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((vals: Partial<ProfileRow>) => ({
        where: vi.fn(async () => {
          if (profileRow) Object.assign(profileRow, vals);
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {}),
    })),
    _rows: rows,
    profileRow: () => profileRow,
  };

  return fakeDb;
}

describe("memory routes", () => {
  describe("PUT /v1/memory/consent", () => {
    it("sets the global memory_enabled flag on the profile", async () => {
      const db = makeFakeDb();
      const app = appWithMemory(createMemoryRoutes({ db: db as never }));

      const res = await app.request("/v1/memory/consent", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(db.profileRow()?.memoryEnabled).toBe(false);
    });

    it("re-enables memory globally", async () => {
      const db = makeFakeDb({ profile: { userId, memoryEnabled: false } });
      const app = appWithMemory(createMemoryRoutes({ db: db as never }));

      const res = await app.request("/v1/memory/consent", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });

      expect(res.status).toBe(200);
      expect(db.profileRow()?.memoryEnabled).toBe(true);
    });

    it("returns 400 on invalid body", async () => {
      const db = makeFakeDb();
      const app = appWithMemory(createMemoryRoutes({ db: db as never }));

      const res = await app.request("/v1/memory/consent", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: "yes" }),
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

    it("returns 409 when memory is globally disabled", async () => {
      const db = makeFakeDb({ profile: { userId, memoryEnabled: false } });
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
      // No memory row should have been written.
      expect(db._rows).toHaveLength(0);
    });
  });

  describe("GET /v1/memory", () => {
    it("returns the global flag plus the user's memories array", async () => {
      const db = makeFakeDb({
        memoryRows: [
          {
            userId,
            languageCode: "fr",
            proficiencyLevel: "B2",
            recentTopics: [],
            weakAreas: ["gender agreement"],
            personalContext: { hobbies: ["reading"] },
            lastSessionSummary: "Discussed books",
            updatedAt: new Date("2026-05-29T00:00:00Z"),
          },
        ],
      });
      const app = appWithMemory(createMemoryRoutes({ db: db as never }));

      const res = await app.request("/v1/memory");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        memory_enabled: boolean;
        memories: Array<{
          language_code: string;
          memory: { proficiency_level: string | null };
        }>;
      };
      expect(body.memory_enabled).toBe(true);
      expect(body.memories).toHaveLength(1);
      expect(body.memories[0]?.language_code).toBe("fr");
      expect(body.memories[0]?.memory.proficiency_level).toBe("B2");
    });

    it("reports memory_enabled=false when the profile is opted out", async () => {
      const db = makeFakeDb({ profile: { userId, memoryEnabled: false } });
      const app = appWithMemory(createMemoryRoutes({ db: db as never }));

      const res = await app.request("/v1/memory");
      const body = (await res.json()) as { memory_enabled: boolean };
      expect(body.memory_enabled).toBe(false);
    });
  });

  describe("DELETE /v1/memory/:lang", () => {
    it("calls db.delete and returns ok", async () => {
      const db = makeFakeDb({
        memoryRows: [
          {
            userId,
            languageCode: "fr",
            proficiencyLevel: null,
            recentTopics: [],
            weakAreas: [],
            personalContext: {},
            lastSessionSummary: null,
            updatedAt: new Date(),
          },
        ],
      });
      const app = appWithMemory(createMemoryRoutes({ db: db as never }));

      const res = await app.request("/v1/memory/fr", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(db.delete).toHaveBeenCalled();
    });
  });

  describe("GET /v1/memory/items", () => {
    it("returns the user's active memory items mapped to the response shape", async () => {
      const db = makeFakeDb({
        memoryItemRows: [
          {
            id: "item-uuid-1",
            userId,
            languageCode: "fr",
            type: "vocabulary",
            content: "bonjour",
            salience: 0.8,
            status: "active",
            createdAt: new Date("2026-01-01T00:00:00Z"),
            lastSeenAt: new Date("2026-01-01T00:00:00Z"),
          },
          {
            id: "item-uuid-2",
            userId,
            languageCode: "fr",
            type: "grammar",
            content: "subjunctive mood",
            salience: 0.6,
            status: "active",
            createdAt: new Date("2026-01-02T00:00:00Z"),
            lastSeenAt: new Date("2026-01-02T00:00:00Z"),
          },
        ],
      });
      const app = appWithMemory(createMemoryRoutes({ db: db as never }));

      const res = await app.request("/v1/memory/items");
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        items: Array<{
          id: string;
          type: string;
          content: string;
          language_code: string;
          created_at: string;
        }>;
      };
      expect(body.items).toHaveLength(2);
      expect(body.items[0]?.id).toBe("item-uuid-1");
      expect(body.items[0]?.type).toBe("vocabulary");
      expect(body.items[0]?.content).toBe("bonjour");
      expect(body.items[0]?.language_code).toBe("fr");
      expect(body.items[1]?.id).toBe("item-uuid-2");

      // Assert ownership/active filter: capture the where callback passed to findMany
      // and invoke it with spies to prove it scopes to userId + status='active'.
      const findManyMock = db.query.memoryItems.findMany;
      const whereFn = findManyMock.mock.calls[0]?.[0]?.where as
        | ((
            t: Record<string, unknown>,
            ops: {
              eq: (col: unknown, val: unknown) => unknown;
              and: (...args: unknown[]) => unknown;
            },
          ) => unknown)
        | undefined;
      expect(whereFn).toBeDefined();
      const eqCalls: Array<[unknown, unknown]> = [];
      const eqSpy = (col: unknown, val: unknown) => {
        eqCalls.push([col, val]);
        return { col, val };
      };
      const andSpy = (...args: unknown[]) => args;
      const t = {
        userId: "userId",
        status: "status",
        languageCode: "languageCode",
      };
      whereFn!(t, { eq: eqSpy, and: andSpy });
      // Must scope to the authenticated user and only 'active' items
      expect(eqCalls).toContainEqual([t.userId, userId]);
      expect(eqCalls).toContainEqual([t.status, "active"]);
      // Must NOT add a languageCode filter when no ?language_code= param was provided
      expect(eqCalls.map(([col]) => col)).not.toContain(t.languageCode);
    });

    it("passes the language_code query param and calls findMany", async () => {
      const db = makeFakeDb({
        memoryItemRows: [
          {
            id: "item-uuid-1",
            userId,
            languageCode: "fr",
            type: "vocabulary",
            content: "bonjour",
            salience: 0.8,
            status: "active",
            createdAt: new Date("2026-01-01T00:00:00Z"),
            lastSeenAt: new Date("2026-01-01T00:00:00Z"),
          },
        ],
      });
      const app = appWithMemory(createMemoryRoutes({ db: db as never }));

      const res = await app.request("/v1/memory/items?language_code=fr");
      expect(res.status).toBe(200);
      expect(db.query.memoryItems.findMany).toHaveBeenCalled();

      // Assert ownership/active/language filter via the where callback.
      const findManyMock = db.query.memoryItems.findMany;
      const whereFn = findManyMock.mock.calls[0]?.[0]?.where as
        | ((
            t: Record<string, unknown>,
            ops: {
              eq: (col: unknown, val: unknown) => unknown;
              and: (...args: unknown[]) => unknown;
            },
          ) => unknown)
        | undefined;
      expect(whereFn).toBeDefined();
      const eqCalls: Array<[unknown, unknown]> = [];
      const eqSpy = (col: unknown, val: unknown) => {
        eqCalls.push([col, val]);
        return { col, val };
      };
      const andSpy = (...args: unknown[]) => args;
      const t = {
        userId: "userId",
        status: "status",
        languageCode: "languageCode",
      };
      whereFn!(t, { eq: eqSpy, and: andSpy });
      // Must scope to the authenticated user, only 'active' items, and the requested language
      expect(eqCalls).toContainEqual([t.userId, userId]);
      expect(eqCalls).toContainEqual([t.status, "active"]);
      expect(eqCalls).toContainEqual([t.languageCode, "fr"]);
    });
  });

  describe("DELETE /v1/memory/items/:id", () => {
    it("calls db.delete and returns { ok: true }", async () => {
      const db = makeFakeDb();
      const app = appWithMemory(createMemoryRoutes({ db: db as never }));

      const res = await app.request("/v1/memory/items/item-uuid-1", {
        method: "DELETE",
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(db.delete).toHaveBeenCalled();
      // Guards that .where() was applied — dropping it would silently delete ALL memory items.
      // (Full cross-user IDOR assertion, i.e. that userId is scoped in the WHERE, requires an
      // integration test — the opaque drizzle `and(eq(...), eq(...))` object can't be inspected
      // from a unit-level mock.)
      const deletedWhere = (
        db.delete.mock.results[0]?.value as { where: Mock } | undefined
      )?.where;
      expect(deletedWhere).toHaveBeenCalledTimes(1);
    });
  });
});
