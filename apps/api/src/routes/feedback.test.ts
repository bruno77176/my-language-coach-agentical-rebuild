import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createFeedbackRoutes, regenerateFeedback } from "./feedback";

/* eslint-disable @typescript-eslint/no-explicit-any */

function mountRetry(deps: any) {
  const app = new Hono<{ Variables: { userId: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", "u1");
    await next();
  });
  app.route("/v1", createFeedbackRoutes(deps));
  return app;
}

// A chainable db.update(...).set(...).where(...).returning() stub.
function updateStub(returnRows: unknown[] = [{ status: "pending" }]) {
  const returning = vi.fn(async () => returnRows);
  const where = vi.fn((..._a: any[]) => ({ returning }));
  const set = vi.fn((..._a: any[]) => ({ where }));
  const update = vi.fn((..._a: any[]) => ({ set }));
  return { update, set, where, returning };
}

describe("feedback routes", () => {
  it("returns the feedback row when present", async () => {
    const deps = {
      generateFeedback: vi.fn(),
      db: {
        query: {
          conversations: {
            findFirst: vi.fn(async () => ({ id: "c1", userId: "u1" })),
          },
          sessionFeedback: {
            findFirst: vi.fn(async () => ({
              status: "ready",
              highlights: [{ phrase: "x", why: "y" }],
              corrections: [],
              vocab: [],
            })),
          },
        },
      } as any,
    };
    const app = new Hono<{ Variables: { userId: string } }>();
    app.use("*", async (c, next) => {
      c.set("userId", "u1");
      await next();
    });
    app.route("/v1", createFeedbackRoutes(deps));
    const res = await app.fetch(
      new Request("http://x/v1/sessions/c1/feedback"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("ready");
  });

  it("404 when conversation isn't the user's", async () => {
    const deps = {
      generateFeedback: vi.fn(),
      db: {
        query: {
          conversations: { findFirst: vi.fn(async () => null) },
          sessionFeedback: { findFirst: vi.fn() },
        },
      } as any,
    };
    const app = new Hono<{ Variables: { userId: string } }>();
    app.use("*", async (c, next) => {
      c.set("userId", "u1");
      await next();
    });
    app.route("/v1", createFeedbackRoutes(deps));
    const res = await app.fetch(
      new Request("http://x/v1/sessions/c1/feedback"),
    );
    expect(res.status).toBe(404);
  });

  it("returns status: missing when no row exists yet", async () => {
    const deps = {
      generateFeedback: vi.fn(),
      db: {
        query: {
          conversations: {
            findFirst: vi.fn(async () => ({ id: "c1", userId: "u1" })),
          },
          sessionFeedback: { findFirst: vi.fn(async () => null) },
        },
      } as any,
    };
    const app = new Hono<{ Variables: { userId: string } }>();
    app.use("*", async (c, next) => {
      c.set("userId", "u1");
      await next();
    });
    app.route("/v1", createFeedbackRoutes(deps));
    const res = await app.fetch(
      new Request("http://x/v1/sessions/c1/feedback"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe("missing");
  });
});

describe("POST /sessions/:id/feedback/retry", () => {
  it("flips a failed row to pending and returns 202", async () => {
    const upd = updateStub([{ status: "pending" }]);
    const generateFeedback = vi.fn();
    const deps = {
      generateFeedback,
      db: {
        query: {
          conversations: {
            findFirst: vi.fn(async () => ({
              id: "c1",
              userId: "u1",
              language: "de",
            })),
          },
          sessionFeedback: {
            findFirst: vi.fn(async () => ({ status: "failed" })),
          },
          profiles: { findFirst: vi.fn(async () => ({ nativeLang: "fr" })) },
          messages: { findMany: vi.fn(async () => []) },
        },
        update: upd.update,
      } as any,
    };
    const res = await mountRetry(deps).fetch(
      new Request("http://x/v1/sessions/c1/feedback/retry", { method: "POST" }),
    );
    expect(res.status).toBe(202);
    expect(((await res.json()) as { status: string }).status).toBe("pending");
    expect(upd.set).toHaveBeenCalledWith({ status: "pending" });
  });

  it("does NOT regenerate an already-ready row (returns it)", async () => {
    const generateFeedback = vi.fn();
    const deps = {
      generateFeedback,
      db: {
        query: {
          conversations: {
            findFirst: vi.fn(async () => ({
              id: "c1",
              userId: "u1",
              language: "de",
            })),
          },
          sessionFeedback: {
            findFirst: vi.fn(async () => ({
              status: "ready",
              highlights: [{ phrase: "x", why: "y" }],
              corrections: [],
              vocab: [],
            })),
          },
        },
        update: vi.fn(),
      } as any,
    };
    const res = await mountRetry(deps).fetch(
      new Request("http://x/v1/sessions/c1/feedback/retry", { method: "POST" }),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { status: string }).status).toBe("ready");
    expect(deps.db.update).not.toHaveBeenCalled();
  });

  it("404s when there is no feedback row to retry", async () => {
    const deps = {
      generateFeedback: vi.fn(),
      db: {
        query: {
          conversations: {
            findFirst: vi.fn(async () => ({ id: "c1", userId: "u1" })),
          },
          sessionFeedback: { findFirst: vi.fn(async () => null) },
        },
        update: vi.fn(),
      } as any,
    };
    const res = await mountRetry(deps).fetch(
      new Request("http://x/v1/sessions/c1/feedback/retry", { method: "POST" }),
    );
    expect(res.status).toBe(404);
  });

  it("404s when the conversation isn't the user's", async () => {
    const deps = {
      generateFeedback: vi.fn(),
      db: {
        query: {
          conversations: { findFirst: vi.fn(async () => null) },
          sessionFeedback: { findFirst: vi.fn() },
        },
        update: vi.fn(),
      } as any,
    };
    const res = await mountRetry(deps).fetch(
      new Request("http://x/v1/sessions/c1/feedback/retry", { method: "POST" }),
    );
    expect(res.status).toBe(404);
  });
});

describe("POST /checkpoints/:id/feedback/retry", () => {
  it("flips a failed checkpoint row to pending and returns 202", async () => {
    const upd = updateStub([{ status: "pending" }]);
    const deps = {
      generateFeedback: vi.fn(),
      db: {
        query: {
          sessionCheckpoints: {
            findFirst: vi.fn(async () => ({
              id: "chk1",
              userId: "u1",
              conversationId: "c1",
              language: "de",
              startedAt: new Date("2026-07-09T19:26:00Z"),
              endedAt: new Date("2026-07-09T19:33:00Z"),
            })),
          },
          sessionFeedback: {
            findFirst: vi.fn(async () => ({ status: "failed" })),
          },
          profiles: { findFirst: vi.fn(async () => ({ nativeLang: "fr" })) },
          messages: { findMany: vi.fn(async () => []) },
        },
        update: upd.update,
      } as any,
    };
    const res = await mountRetry(deps).fetch(
      new Request("http://x/v1/checkpoints/chk1/feedback/retry", {
        method: "POST",
      }),
    );
    expect(res.status).toBe(202);
    expect(upd.set).toHaveBeenCalledWith({ status: "pending" });
  });
});

describe("regenerateFeedback", () => {
  const baseArgs = {
    userId: "u1",
    conversationId: "c1",
    checkpointId: null as string | null,
    language: "de",
    nativeLang: "fr",
    platform: "ios",
    range: null as { start: Date; end: Date } | null,
  };

  function dbWith(update: ReturnType<typeof updateStub>) {
    return {
      query: {
        messages: {
          findMany: vi.fn(async () => [
            { role: "user", text: "Hallo" },
            { role: "coach", text: "Hi" },
          ]),
        },
      },
      update: update.update,
      // persistVocab path
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          onConflictDoUpdate: vi.fn(async () => undefined),
          onConflictDoNothing: vi.fn(async () => undefined),
        })),
      })),
    } as any;
  }

  it("writes status=ready + report when generation succeeds", async () => {
    const upd = updateStub([]);
    const generateFeedback = vi.fn(async () => ({
      highlights: [{ phrase: "Hallo", why: "warm" }],
      corrections: [],
      vocab: [],
    }));
    await regenerateFeedback({
      ...baseArgs,
      db: dbWith(upd),
      generateFeedback: generateFeedback as any,
    });
    expect(generateFeedback).toHaveBeenCalledOnce();
    const setArg = upd.set.mock.calls.at(-1)![0] as any;
    expect(setArg.status).toBe("ready");
    expect(setArg.highlights[0].phrase).toBe("Hallo");
  });

  it("writes status=failed when generation returns null", async () => {
    const upd = updateStub([]);
    const generateFeedback = vi.fn(async () => null);
    await regenerateFeedback({
      ...baseArgs,
      db: dbWith(upd),
      generateFeedback: generateFeedback as any,
    });
    expect(upd.set).toHaveBeenLastCalledWith({ status: "failed" });
  });
});
