import { describe, expect, it, vi } from "vitest";
import { createApp } from "../app";
import type { Database } from "../db";

const baseEnv = {
  NODE_ENV: "test" as const,
  PORT: 3000,
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "p",
  SUPABASE_SECRET_KEY: "s",
  DATABASE_URL: "postgres://u:p@localhost:5432/d",
  SENTRY_DSN: "https://stub@sentry.io/1",
  OPENAI_API_KEY: "o",
  DEEPGRAM_API_KEY: "d",
  ELEVENLABS_API_KEY: "e",
  ADMIN_USER_IDS: "admin-1",
  ADMIN_ALLOWED_ORIGINS: "",
  INTERNAL_CRON_SECRET: "test-cron-secret-1234567890",
};

describe("GET /admin/overview", () => {
  it("403 for non-admin", async () => {
    const fakeDb = { execute: vi.fn() } as unknown as Database;
    const app = createApp(baseEnv, fakeDb, {
      verifier: async () => ({ userId: "not-admin" }),
    });
    const res = await app.request("/admin/overview?from=2026-05-01&to=2026-05-31", {
      headers: { Authorization: "Bearer t" },
    });
    expect(res.status).toBe(403);
  });

  it("returns aggregates for admin", async () => {
    const fakeDb = {
      execute: vi
        .fn()
        .mockResolvedValueOnce([
          { variable_cost: "10", active_users: 2, event_count: 8 },
        ])
        .mockResolvedValueOnce([]) // fixed
        .mockResolvedValueOnce([]), // upfront
    } as unknown as Database;
    const app = createApp(baseEnv, fakeDb, {
      verifier: async () => ({ userId: "admin-1" }),
    });
    const res = await app.request(
      "/admin/overview?from=2026-05-01&to=2026-05-31",
      { headers: { Authorization: "Bearer t" } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { totalCostUsd: number };
    expect(body.totalCostUsd).toBeCloseTo(10, 2);
  });
});

describe("GET /admin/by-service", () => {
  it("returns service breakdown", async () => {
    const fakeDb = {
      execute: vi.fn().mockResolvedValue([
        { service: "openai", cost: "8", units: "1000", event_count: 5 },
      ]),
    } as unknown as Database;
    const app = createApp(baseEnv, fakeDb, {
      verifier: async () => ({ userId: "admin-1" }),
    });
    const res = await app.request(
      "/admin/by-service?from=2026-05-01&to=2026-05-31",
      { headers: { Authorization: "Bearer t" } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ service: string }>;
    expect(body[0]?.service).toBe("openai");
  });
});

describe("GET /admin/auth/me", () => {
  it("returns isAdmin=true for admin user", async () => {
    const fakeDb = { execute: vi.fn() } as unknown as Database;
    const app = createApp(baseEnv, fakeDb, {
      verifier: async () => ({ userId: "admin-1" }),
    });
    const res = await app.request("/admin/auth/me", {
      headers: { Authorization: "Bearer t" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { isAdmin: boolean; userId: string };
    expect(body.isAdmin).toBe(true);
    expect(body.userId).toBe("admin-1");
  });
});

// Helper for inspecting Drizzle SQL objects passed to db.execute.
// Drizzle SQL objects expose interleaved static-string chunks and param values
// via `queryChunks`. Flatten to a single inspectable string.
function flattenSql(call: unknown): string {
  const sqlObj = call as {
    queryChunks?: Array<{ value?: string[] } | unknown>;
  };
  if (!sqlObj.queryChunks) return String(call);
  return sqlObj.queryChunks
    .map((c) => {
      if (c && typeof c === "object" && "value" in c) {
        return (c as { value: string[] }).value.join("");
      }
      return String(c);
    })
    .join("|");
}

describe("GET /admin/rate-cards", () => {
  it("returns rate-card list for admin", async () => {
    const fakeDb = {
      execute: vi.fn().mockResolvedValue([
        {
          id: "rc-1",
          provider: "openai",
          operation: "chat",
          unit_type: "input_tokens",
          price_per_unit: "0.0000015",
          effective_from: "2026-01-01T00:00:00Z",
          effective_to: null,
          notes: null,
        },
      ]),
    } as unknown as Database;
    const app = createApp(baseEnv, fakeDb, {
      verifier: async () => ({ userId: "admin-1" }),
    });
    const res = await app.request("/admin/rate-cards", {
      headers: { Authorization: "Bearer t" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ provider: string }>;
    expect(body[0]?.provider).toBe("openai");
  });
});

describe("POST /admin/rate-cards", () => {
  it("closes the active row then inserts a new one", async () => {
    const execute = vi.fn().mockResolvedValue([]);
    const fakeDb = { execute } as unknown as Database;
    const app = createApp(baseEnv, fakeDb, {
      verifier: async () => ({ userId: "admin-1" }),
    });
    const res = await app.request("/admin/rate-cards", {
      method: "POST",
      headers: {
        Authorization: "Bearer t",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        provider: "openai",
        operation: "chat",
        unitType: "input_tokens",
        pricePerUnit: "0.0000025",
        notes: "rate bump",
      }),
    });
    expect(res.status).toBe(201);
    expect(execute).toHaveBeenCalledTimes(2);
    const updateSql = flattenSql(execute.mock.calls[0]?.[0]);
    const insertSql = flattenSql(execute.mock.calls[1]?.[0]);
    expect(updateSql).toMatch(/UPDATE\s+rate_cards/);
    expect(updateSql).toMatch(/effective_to\s*=\s*NOW\(\)/);
    expect(insertSql).toMatch(/INSERT\s+INTO\s+rate_cards/);
  });
});

describe("GET /admin/fixed-costs", () => {
  it("returns fixed-cost list for admin", async () => {
    const fakeDb = {
      execute: vi.fn().mockResolvedValue([
        {
          id: "fc-1",
          service: "render",
          amount_usd: "7.00",
          period: "monthly",
          started_on: "2026-01-01",
          ended_on: null,
          notes: null,
        },
      ]),
    } as unknown as Database;
    const app = createApp(baseEnv, fakeDb, {
      verifier: async () => ({ userId: "admin-1" }),
    });
    const res = await app.request("/admin/fixed-costs", {
      headers: { Authorization: "Bearer t" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ service: string }>;
    expect(body[0]?.service).toBe("render");
  });
});

describe("POST /admin/fixed-costs", () => {
  it("issues a single INSERT", async () => {
    const execute = vi.fn().mockResolvedValue([]);
    const fakeDb = { execute } as unknown as Database;
    const app = createApp(baseEnv, fakeDb, {
      verifier: async () => ({ userId: "admin-1" }),
    });
    const res = await app.request("/admin/fixed-costs", {
      method: "POST",
      headers: {
        Authorization: "Bearer t",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service: "fly.io",
        amountUsd: "5.00",
        period: "monthly",
        startedOn: "2026-05-01",
      }),
    });
    expect(res.status).toBe(201);
    expect(execute).toHaveBeenCalledTimes(1);
    const insertSql = flattenSql(execute.mock.calls[0]?.[0]);
    expect(insertSql).toMatch(/INSERT\s+INTO\s+fixed_costs/);
  });
});

describe("DELETE /admin/upfront-costs/:id", () => {
  it("issues a DELETE for the given id", async () => {
    const execute = vi.fn().mockResolvedValue([]);
    const fakeDb = { execute } as unknown as Database;
    const app = createApp(baseEnv, fakeDb, {
      verifier: async () => ({ userId: "admin-1" }),
    });
    const res = await app.request("/admin/upfront-costs/abc-123", {
      method: "DELETE",
      headers: { Authorization: "Bearer t" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
    const deleteSql = flattenSql(execute.mock.calls[0]?.[0]);
    expect(deleteSql).toMatch(/DELETE\s+FROM\s+upfront_costs/);
  });
});
