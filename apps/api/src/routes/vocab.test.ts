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
  sourceSentence: string | null;
  article: string | null;
  mastery: number;
  starred: boolean;
  srsBox: number;
  dueAt: Date | null;
  lastReviewedAt: Date | null;
  createdAt: Date;
};

// Minimal interpreters for the drizzle relational `where` / `orderBy` callbacks
// so the fake db can actually filter + sort (needed for /review/today).
const tProxy = new Proxy(
  {},
  { get: (_t, p) => ({ __key: String(p) }) },
) as Record<string, { __key: keyof VocabRow }>;
type Pred = (r: VocabRow) => boolean;
const whereOps = {
  eq:
    (c: { __key: keyof VocabRow }, v: unknown): Pred =>
    (r) =>
      r[c.__key] === v,
  and:
    (...ps: Pred[]): Pred =>
    (r) =>
      ps.every((p) => p(r)),
  isNull:
    (c: { __key: keyof VocabRow }): Pred =>
    (r) =>
      r[c.__key] == null,
  isNotNull:
    (c: { __key: keyof VocabRow }): Pred =>
    (r) =>
      r[c.__key] != null,
  lte:
    (c: { __key: keyof VocabRow }, v: unknown): Pred =>
    (r) => {
      const x = r[c.__key];
      return x != null && toMs(x) <= toMs(v);
    },
};
const orderOps = {
  asc: (c: { __key: keyof VocabRow }) => ({ key: c.__key, dir: 1 }),
  desc: (c: { __key: keyof VocabRow }) => ({ key: c.__key, dir: -1 }),
};
function toMs(v: unknown): number {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  return new Date(v as string).getTime();
}
function cmp(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (a instanceof Date || b instanceof Date || typeof a === "number")
    return toMs(a) - toMs(b);
  return String(a).localeCompare(String(b));
}

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
        findMany: vi.fn(
          async (
            cfg: {
              where?: (t: typeof tProxy, ops: typeof whereOps) => Pred;
              orderBy?: (
                t: typeof tProxy,
                ops: typeof orderOps,
              ) => Array<{ key: keyof VocabRow; dir: number }>;
              limit?: number;
            } = {},
          ) => {
            let rows = data.filter((r) => r.userId === userId);
            if (cfg.where) rows = rows.filter(cfg.where(tProxy, whereOps));
            if (cfg.orderBy) {
              const ord = cfg.orderBy(tProxy, orderOps);
              rows = [...rows].sort((a, b) => {
                for (const o of ord) {
                  const c = cmp(a[o.key], b[o.key]) * o.dir;
                  if (c) return c;
                }
                return 0;
              });
            }
            if (typeof cfg.limit === "number") rows = rows.slice(0, cfg.limit);
            return rows;
          },
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
              sourceSentence: vals.sourceSentence ?? null,
              article: vals.article ?? null,
              mastery: 0,
              starred: false,
              srsBox: vals.srsBox ?? 1,
              dueAt: vals.dueAt ?? null,
              lastReviewedAt: vals.lastReviewedAt ?? null,
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
    sourceSentence: null,
    article: null,
    mastery: 0,
    starred: false,
    srsBox: 1,
    dueAt: null,
    lastReviewedAt: null,
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

  it("POST /v1/vocab enriches with the gender article + source sentence (BRU-31/11)", async () => {
    translate.mockClear();
    const db = makeFakeDb({
      profile: { userId, targetLang: "de", nativeLang: "en" },
    });
    const enrichVocab = vi.fn(async () => ({
      translation: "table",
      article: "der",
    }));
    const app = appWithVocab(createVocabRoutes(deps(db, { enrichVocab })));
    const res = await app.request("/v1/vocab", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        language: "de",
        term: "Tisch",
        source_sentence: "Ich habe einen Tisch gekauft.",
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { item: VocabRow };
    expect(body.item.translation).toBe("table");
    expect(body.item.article).toBe("der");
    expect(body.item.sourceSentence).toBe("Ich habe einen Tisch gekauft.");
    // Enrichment replaces the translate-only path when wired.
    expect(enrichVocab).toHaveBeenCalledOnce();
    expect(translate).not.toHaveBeenCalled();
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

  it("PATCH got_it promotes the Leitner box + sets a due date (BRU-30)", async () => {
    const db = makeFakeDb({ rows: [row({ srsBox: 2, mastery: 1 })] });
    db._matchId = "a";
    const app = appWithVocab(createVocabRoutes(deps(db)));
    const res = await app.request("/v1/vocab/a", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ result: "got_it" }),
    });
    expect(res.status).toBe(200);
    const r = db._data.find((x) => x.id === "a")!;
    expect(r.srsBox).toBe(3); // promoted one box
    expect(r.mastery).toBe(2); // mirrored
    expect(r.dueAt).toBeInstanceOf(Date); // scheduled
    expect(r.lastReviewedAt).toBeInstanceOf(Date);
  });

  it("PATCH still_learning drops to box 1 (BRU-30)", async () => {
    const db = makeFakeDb({ rows: [row({ srsBox: 4, mastery: 3 })] });
    db._matchId = "a";
    const app = appWithVocab(createVocabRoutes(deps(db)));
    const res = await app.request("/v1/vocab/a", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ result: "still_learning" }),
    });
    expect(res.status).toBe(200);
    const r = db._data.find((x) => x.id === "a")!;
    expect(r.srsBox).toBe(1);
    expect(r.mastery).toBe(0);
    expect(r.dueAt).toBeInstanceOf(Date);
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

  it("POST /:id/pronounce marks correct + advances the box when the transcript matches", async () => {
    const db = makeFakeDb({ rows: [row({ term: "maison", srsBox: 1 })] });
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
    const r = db._data.find((x) => x.id === "a")!;
    expect(r.srsBox).toBe(2);
    expect(r.dueAt).toBeInstanceOf(Date);
  });

  it("POST /:id/pronounce marks incorrect + resets the box on a wrong word", async () => {
    const db = makeFakeDb({ rows: [row({ term: "maison", srsBox: 3 })] });
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
    expect(db._data.find((x) => x.id === "a")?.srsBox).toBe(1);
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

  it("GET /review/today returns due-first then new fill, with counts (BRU-30)", async () => {
    const now = Date.now();
    const past = new Date(now - 86_400_000); // due yesterday
    const future = new Date(now + 7 * 86_400_000); // not due yet
    const db = makeFakeDb({
      rows: [
        row({
          id: "due1",
          term: "alpha",
          dueAt: past,
          createdAt: new Date("2026-06-01T00:00:00Z"),
        }),
        row({ id: "notdue", term: "beta", dueAt: future }),
        row({
          id: "new1",
          term: "gamma",
          dueAt: null,
          createdAt: new Date("2026-06-02T00:00:00Z"),
        }),
        row({
          id: "new2",
          term: "delta",
          dueAt: null,
          createdAt: new Date("2026-06-03T00:00:00Z"),
        }),
      ],
    });
    const app = appWithVocab(createVocabRoutes(deps(db)));
    const res = await app.request("/v1/vocab/review/today?language=fr");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: VocabRow[];
      dueCount: number;
      newCount: number;
      remainingTotal: number;
    };
    expect(body.dueCount).toBe(1); // only due1 (past); notdue is in the future
    expect(body.newCount).toBe(2); // new1 + new2
    expect(body.remainingTotal).toBe(3);
    const ids = body.items.map((i) => i.id);
    expect(ids[0]).toBe("due1"); // due first
    expect(ids).toContain("new1");
    expect(ids).toContain("new2");
    expect(ids).not.toContain("notdue");
    expect(body.items).toHaveLength(3); // 1 due + 2 new, under the 15 cap
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
