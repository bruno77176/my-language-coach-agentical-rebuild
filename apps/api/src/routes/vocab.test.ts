import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createVocabRoutes } from "./vocab";

const userId = "00000000-0000-0000-0000-000000000001";

type VocabRow = {
  id: string;
  userId: string;
  language: string;
  term: string;
  translation: string | null;
  mastery: number;
  starred: boolean;
  createdAt: Date;
};

function appWithVocab(routes: ReturnType<typeof createVocabRoutes>) {
  const app = new Hono<{ Variables: { userId: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", userId);
    await next();
  });
  app.route("/v1/vocab", routes);
  return app;
}

// Minimal fake db covering the drizzle calls vocab.ts makes. PATCH/DELETE/
// pronounce lookups go through findFirst, which returns the row whose id equals
// the test-controlled `_matchId` (the real query filters by (id, userId)).
function makeFakeDb({
  rows = [] as VocabRow[],
  profile = { userId, targetLang: "fr", nativeLang: "en" } as
    | { userId: string; targetLang: string; nativeLang: string }
    | undefined,
} = {}) {
  const data: VocabRow[] = [...rows];
  let idCounter = data.length;

  const fakeDb = {
    query: {
      profiles: {
        findFirst: vi.fn(async () => profile),
      },
      vocabItems: {
        findMany: vi.fn(async () =>
          data
            .filter((r) => r.userId === userId)
            .sort(
              (a, b) =>
                a.mastery - b.mastery ||
                b.createdAt.getTime() - a.createdAt.getTime(),
            ),
        ),
        findFirst: vi.fn(async () =>
          data.find((r) => r.id === fakeDb._matchId),
        ),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn((vals: Partial<VocabRow>) => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(async () => {
            const existing = data.find(
              (r) =>
                r.userId === vals.userId &&
                r.language === vals.language &&
                r.term === vals.term,
            );
            if (existing) return []; // conflict → no row returned
            const row: VocabRow = {
              id: `id-${++idCounter}`,
              userId: vals.userId!,
              language: vals.language!,
              term: vals.term!,
              translation: vals.translation ?? null,
              mastery: 0,
              starred: false,
              createdAt: new Date("2026-06-06T00:00:00Z"),
            };
            data.push(row);
            return [row];
          }),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((vals: Partial<VocabRow>) => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => {
            const row = data.find((r) => r.id === fakeDb._matchId);
            if (!row) return [];
            Object.assign(row, vals);
            return [row];
          }),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => {
          const idx = data.findIndex((r) => r.id === fakeDb._matchId);
          if (idx === -1) return [];
          return data.splice(idx, 1);
        }),
      })),
    })),
    _data: data,
    _matchId: undefined as string | undefined,
  };
  return fakeDb;
}

const translate = vi.fn(async () => "house");
const transcribe = vi.fn(async () => ({ text: "maison", durationSeconds: 1 }));

function deps(db: ReturnType<typeof makeFakeDb>, over = {}) {
  return { db: db as never, translate, transcribe, ...over };
}

function row(over: Partial<VocabRow> = {}): VocabRow {
  return {
    id: "a",
    userId,
    language: "fr",
    term: "maison",
    translation: "house",
    mastery: 0,
    starred: false,
    createdAt: new Date("2026-06-02T00:00:00Z"),
    ...over,
  };
}

describe("vocab routes", () => {
  it("GET /v1/vocab returns deck sorted by mastery asc with dueCount + starredCount", async () => {
    const db = makeFakeDb({
      rows: [
        row({ id: "a", term: "maison", mastery: 3, starred: true }),
        row({
          id: "b",
          term: "chien",
          translation: "dog",
          mastery: 0,
          createdAt: new Date("2026-06-03T00:00:00Z"),
        }),
      ],
    });
    const app = appWithVocab(createVocabRoutes(deps(db)));
    const res = await app.request("/v1/vocab?language=fr");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: VocabRow[];
      dueCount: number;
      starredCount: number;
    };
    expect(body.items[0]?.term).toBe("chien"); // mastery 0 first
    expect(body.dueCount).toBe(1);
    expect(body.starredCount).toBe(1);
  });

  it("POST /v1/vocab auto-translates when translation omitted", async () => {
    const db = makeFakeDb();
    const app = appWithVocab(createVocabRoutes(deps(db)));
    const res = await app.request("/v1/vocab", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language: "fr", term: "maison" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { item: VocabRow };
    expect(body.item.translation).toBe("house");
    expect(translate).toHaveBeenCalled();
  });

  it("POST /v1/vocab returns 400 when term missing", async () => {
    const db = makeFakeDb();
    const app = appWithVocab(createVocabRoutes(deps(db)));
    const res = await app.request("/v1/vocab", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language: "fr" }),
    });
    expect(res.status).toBe(400);
  });

  it("PATCH got_it increments mastery, capped at 3", async () => {
    const db = makeFakeDb({ rows: [row({ mastery: 3 })] });
    db._matchId = "a";
    const app = appWithVocab(createVocabRoutes(deps(db)));
    const res = await app.request("/v1/vocab/a", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ result: "got_it" }),
    });
    expect(res.status).toBe(200);
    expect(db._data.find((r) => r.id === "a")?.mastery).toBe(3);
  });

  it("PATCH still_learning resets mastery to 0", async () => {
    const db = makeFakeDb({ rows: [row({ mastery: 2 })] });
    db._matchId = "a";
    const app = appWithVocab(createVocabRoutes(deps(db)));
    const res = await app.request("/v1/vocab/a", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ result: "still_learning" }),
    });
    expect(res.status).toBe(200);
    expect(db._data.find((r) => r.id === "a")?.mastery).toBe(0);
  });

  it("PATCH starred toggles the starred flag", async () => {
    const db = makeFakeDb({ rows: [row({ starred: false })] });
    db._matchId = "a";
    const app = appWithVocab(createVocabRoutes(deps(db)));
    const res = await app.request("/v1/vocab/a", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ starred: true }),
    });
    expect(res.status).toBe(200);
    expect(db._data.find((r) => r.id === "a")?.starred).toBe(true);
  });

  it("PATCH returns 400 on invalid body", async () => {
    const db = makeFakeDb();
    db._matchId = "a";
    const app = appWithVocab(createVocabRoutes(deps(db)));
    const res = await app.request("/v1/vocab/a", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ result: "maybe" }),
    });
    expect(res.status).toBe(400);
  });

  it("PATCH returns 404 when the row is not the caller's", async () => {
    const db = makeFakeDb();
    db._matchId = "nonexistent";
    const app = appWithVocab(createVocabRoutes(deps(db)));
    const res = await app.request("/v1/vocab/zzz", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ result: "got_it" }),
    });
    expect(res.status).toBe(404);
  });

  it("POST /:id/pronounce marks correct + bumps mastery when the transcript matches", async () => {
    const db = makeFakeDb({ rows: [row({ term: "maison", mastery: 0 })] });
    db._matchId = "a";
    const localTranscribe = vi.fn(async () => ({
      text: "maison",
      durationSeconds: 1,
    }));
    const app = appWithVocab(
      createVocabRoutes(deps(db, { transcribe: localTranscribe })),
    );
    const fd = new FormData();
    fd.append("audio", new Blob([new Uint8Array([1, 2, 3])]), "a.m4a");
    const res = await app.request("/v1/vocab/a/pronounce", {
      method: "POST",
      body: fd,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { correct: boolean; heard: string };
    expect(body.correct).toBe(true);
    expect(db._data.find((r) => r.id === "a")?.mastery).toBe(1);
  });

  it("POST /:id/pronounce marks incorrect + resets mastery on a wrong word", async () => {
    const db = makeFakeDb({ rows: [row({ term: "maison", mastery: 2 })] });
    db._matchId = "a";
    const localTranscribe = vi.fn(async () => ({
      text: "chien",
      durationSeconds: 1,
    }));
    const app = appWithVocab(
      createVocabRoutes(deps(db, { transcribe: localTranscribe })),
    );
    const fd = new FormData();
    fd.append("audio", new Blob([new Uint8Array([1, 2, 3])]), "a.m4a");
    const res = await app.request("/v1/vocab/a/pronounce", {
      method: "POST",
      body: fd,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { correct: boolean };
    expect(body.correct).toBe(false);
    expect(db._data.find((r) => r.id === "a")?.mastery).toBe(0);
  });

  it("POST /:id/pronounce treats a failed transcription as incorrect", async () => {
    const db = makeFakeDb({ rows: [row({ term: "maison", mastery: 1 })] });
    db._matchId = "a";
    const localTranscribe = vi.fn(async () => {
      throw new Error("AUDIO_SILENT");
    });
    const app = appWithVocab(
      createVocabRoutes(deps(db, { transcribe: localTranscribe })),
    );
    const fd = new FormData();
    fd.append("audio", new Blob([new Uint8Array([1, 2, 3])]), "a.m4a");
    const res = await app.request("/v1/vocab/a/pronounce", {
      method: "POST",
      body: fd,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { correct: boolean };
    expect(body.correct).toBe(false);
    expect(db._data.find((r) => r.id === "a")?.mastery).toBe(0);
  });

  it("DELETE removes the row and returns ok", async () => {
    const db = makeFakeDb({ rows: [row()] });
    db._matchId = "a";
    const app = appWithVocab(createVocabRoutes(deps(db)));
    const res = await app.request("/v1/vocab/a", { method: "DELETE" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(db._data.find((r) => r.id === "a")).toBeUndefined();
  });

  it("DELETE returns 404 when nothing was deleted", async () => {
    const db = makeFakeDb();
    db._matchId = "nope";
    const app = appWithVocab(createVocabRoutes(deps(db)));
    const res = await app.request("/v1/vocab/zzz", { method: "DELETE" });
    expect(res.status).toBe(404);
  });
});
