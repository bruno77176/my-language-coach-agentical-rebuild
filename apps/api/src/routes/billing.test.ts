import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createBillingRoutes } from "./billing";

const FAKE_SECRET = "shh-test-secret-12345";

function makeApp() {
  const where = vi.fn();
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const deps = {
    db: { update } as never,
    webhookSecret: FAKE_SECRET,
  };
  const app = new Hono();
  app.route("/v1/billing", createBillingRoutes(deps));
  return { app, update };
}

describe("billing routes", () => {
  it("rejects without bearer secret", async () => {
    const { app } = makeApp();
    const res = await app.fetch(
      new Request("http://x/v1/billing/revenuecat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          event: { type: "INITIAL_PURCHASE", app_user_id: "u1" },
        }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it("accepts with correct bearer secret", async () => {
    const { app, update } = makeApp();
    const res = await app.fetch(
      new Request("http://x/v1/billing/revenuecat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${FAKE_SECRET}`,
        },
        body: JSON.stringify({
          event: {
            type: "INITIAL_PURCHASE",
            app_user_id: "u1",
            expiration_at_ms: Date.now() + 86400000,
          },
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalled();
  });

  it("400 on malformed body", async () => {
    const { app } = makeApp();
    const res = await app.fetch(
      new Request("http://x/v1/billing/revenuecat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${FAKE_SECRET}`,
        },
        body: "not json at all",
      }),
    );
    expect(res.status).toBe(400);
  });
});
