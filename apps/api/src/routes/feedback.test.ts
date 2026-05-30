import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createFeedbackRoutes } from "./feedback";

/* eslint-disable @typescript-eslint/no-explicit-any */

describe("feedback routes", () => {
  it("returns the feedback row when present", async () => {
    const deps = {
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
