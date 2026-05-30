import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createWeeklySummaryRoutes } from "./weekly-summary";

/* eslint-disable @typescript-eslint/no-explicit-any */

describe("weekly-summary route", () => {
  it("returns numeric aggregates", async () => {
    const deps = {
      db: {
        execute: vi.fn(async () => ({
          rows: [
            {
              session_count: "3",
              total_seconds: 720,
              languages_practiced: "1",
            },
          ],
        })),
      } as any,
    };
    const app = new Hono<{ Variables: { userId: string } }>();
    app.use("*", async (c, next) => {
      c.set("userId", "u1");
      await next();
    });
    app.route("/v1/progress", createWeeklySummaryRoutes(deps));
    const res = await app.fetch(
      new Request("http://x/v1/progress/weekly-summary"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.session_count).toBe(3);
    expect(body.total_seconds).toBe(720);
    expect(body.languages_practiced).toBe(1);
  });

  it("returns zeros when no rows match", async () => {
    const deps = {
      db: {
        execute: vi.fn(async () => ({ rows: [] })),
      } as any,
    };
    const app = new Hono<{ Variables: { userId: string } }>();
    app.use("*", async (c, next) => {
      c.set("userId", "u1");
      await next();
    });
    app.route("/v1/progress", createWeeklySummaryRoutes(deps));
    const res = await app.fetch(
      new Request("http://x/v1/progress/weekly-summary"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.session_count).toBe(0);
    expect(body.total_seconds).toBe(0);
    expect(body.languages_practiced).toBe(0);
  });

  it("handles array-shaped execute result (postgres-js adapter)", async () => {
    // postgres-js drizzle returns rows as an array directly, not { rows: [...] }.
    // Verify the fallback path works so the route is portable across adapters.
    const deps = {
      db: {
        execute: vi.fn(async () => [
          {
            session_count: 2,
            total_seconds: "180",
            languages_practiced: 1,
          },
        ]),
      } as any,
    };
    const app = new Hono<{ Variables: { userId: string } }>();
    app.use("*", async (c, next) => {
      c.set("userId", "u1");
      await next();
    });
    app.route("/v1/progress", createWeeklySummaryRoutes(deps));
    const res = await app.fetch(
      new Request("http://x/v1/progress/weekly-summary"),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.session_count).toBe(2);
    expect(body.total_seconds).toBe(180);
    expect(body.languages_practiced).toBe(1);
  });
});
