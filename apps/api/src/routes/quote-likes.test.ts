import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createQuoteLikesRoutes } from "./quote-likes";

const userId = "00000000-0000-0000-0000-000000000001";

type LikeRow = { userId: string; quoteId: string };

function makeFakeDb(rows: LikeRow[] = []) {
  const data: LikeRow[] = [...rows];
  return {
    _data: data,
    query: {
      quoteLikes: {
        findMany: vi.fn(async () => data.filter((r) => r.userId === userId)),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn((v: LikeRow) => ({
        onConflictDoNothing: vi.fn(async () => {
          if (
            !data.some((r) => r.userId === v.userId && r.quoteId === v.quoteId)
          )
            data.push(v);
        }),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        // The route filters by (userId, quoteId); the test sets a single target.
        const idx = data.findIndex((r) => r.quoteId === fakeTarget.quoteId);
        if (idx >= 0) data.splice(idx, 1);
      }),
    })),
  };
}
const fakeTarget = { quoteId: "" };

function app(db: ReturnType<typeof makeFakeDb>) {
  const a = new Hono<{ Variables: { userId: string } }>();
  a.use("*", async (c, next) => {
    c.set("userId", userId);
    await next();
  });
  a.route("/v1/quotes", createQuoteLikesRoutes({ db: db as never }));
  return a;
}

describe("quote likes routes", () => {
  it("GET /likes returns the user's liked quote ids", async () => {
    const db = makeFakeDb([
      { userId, quoteId: "wittgenstein-grenzen" },
      { userId, quoteId: "camus-revolte" },
    ]);
    const res = await app(db).request("/v1/quotes/likes");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      quoteIds: ["wittgenstein-grenzen", "camus-revolte"],
    });
  });

  it("PUT /:id/like persists a like idempotently", async () => {
    const db = makeFakeDb();
    const res = await app(db).request("/v1/quotes/camus-revolte/like", {
      method: "PUT",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, liked: true });
    expect(db._data).toEqual([{ userId, quoteId: "camus-revolte" }]);
    // Second like → still one row.
    await app(db).request("/v1/quotes/camus-revolte/like", { method: "PUT" });
    expect(db._data).toHaveLength(1);
  });

  it("DELETE /:id/like removes the like", async () => {
    const db = makeFakeDb([{ userId, quoteId: "camus-revolte" }]);
    fakeTarget.quoteId = "camus-revolte";
    const res = await app(db).request("/v1/quotes/camus-revolte/like", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, liked: false });
    expect(db._data).toHaveLength(0);
  });
});
