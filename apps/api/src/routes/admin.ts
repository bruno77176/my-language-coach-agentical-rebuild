import { Hono } from "hono";
import { z } from "zod";
import { sql } from "drizzle-orm";
import type { Database } from "../db";
import { createRequireAdmin } from "../lib/require-admin";
import type { Verifier } from "../middleware/auth";
import {
  getOverview,
  getByService,
  getByPlatform,
  getByUser,
  getTimeseries,
  type Filters,
} from "../lib/cost-aggregation";

const FiltersSchema = z.object({
  from: z.string().refine((s) => !isNaN(Date.parse(s)), "invalid from"),
  to: z.string().refine((s) => !isNaN(Date.parse(s)), "invalid to"),
  platform: z.string().optional(),
  service: z.string().optional(),
  userId: z.string().optional(),
});

function parseFilters(query: Record<string, string | undefined>): Filters {
  const parsed = FiltersSchema.parse(query);
  return {
    from: new Date(parsed.from),
    to: new Date(parsed.to),
    platform: parsed.platform || undefined,
    service: parsed.service || undefined,
    userId: parsed.userId || undefined,
  };
}

export function createAdminRoutes(deps: {
  db: Database;
  adminUserIds: string[];
  verifier: Verifier;
}) {
  const routes = new Hono<{ Variables: { userId: string } }>();

  routes.use(
    "*",
    createRequireAdmin({
      adminUserIds: deps.adminUserIds,
      verify: deps.verifier,
    }),
  );

  routes.get("/auth/me", (c) => {
    return c.json({
      userId: c.get("userId"),
      isAdmin: true, // already checked by middleware
    });
  });

  routes.get("/overview", async (c) => {
    const f = parseFilters(c.req.query());
    const data = await getOverview(deps.db, f);
    return c.json(data);
  });

  routes.get("/by-service", async (c) => {
    const f = parseFilters(c.req.query());
    return c.json(await getByService(deps.db, f));
  });

  routes.get("/by-platform", async (c) => {
    const f = parseFilters(c.req.query());
    return c.json(await getByPlatform(deps.db, f));
  });

  routes.get("/by-user", async (c) => {
    const f = parseFilters(c.req.query());
    return c.json(await getByUser(deps.db, f));
  });

  routes.get("/timeseries", async (c) => {
    const f = parseFilters(c.req.query());
    return c.json(await getTimeseries(deps.db, f));
  });

  // User detail (overview + service split + timeseries) for a single user.
  routes.get("/users/:id", async (c) => {
    const userId = c.req.param("id");
    const f = parseFilters(c.req.query());
    const filtersWithUser: Filters = { ...f, userId };
    const [overview, byService, timeseries] = await Promise.all([
      getOverview(deps.db, filtersWithUser),
      getByService(deps.db, filtersWithUser),
      getTimeseries(deps.db, filtersWithUser),
    ]);
    return c.json({ userId, overview, byService, timeseries });
  });

  // CRUD endpoints added in Task 9
  routes.get("/rate-cards", async (c) => {
    const rows = await deps.db.execute(sql`
      SELECT id, provider, operation, unit_type, price_per_unit::text,
             effective_from, effective_to, notes
      FROM rate_cards
      ORDER BY provider, operation, unit_type, effective_from DESC
    `);
    return c.json(rows);
  });

  routes.post("/rate-cards", async (c) => {
    const body = RateCardInput.parse(await c.req.json());
    // Close any currently-active row for the same (provider, operation, unitType)
    await deps.db.execute(sql`
      UPDATE rate_cards
      SET effective_to = NOW()
      WHERE provider = ${body.provider}
        AND operation = ${body.operation}
        AND unit_type = ${body.unitType}
        AND effective_to IS NULL
    `);
    await deps.db.execute(sql`
      INSERT INTO rate_cards
        (provider, operation, unit_type, price_per_unit, effective_from, notes)
      VALUES
        (${body.provider}, ${body.operation}, ${body.unitType},
         ${body.pricePerUnit}, NOW(), ${body.notes ?? null})
    `);
    return c.json({ ok: true }, 201);
  });

  routes.get("/fixed-costs", async (c) => {
    const rows = await deps.db.execute(sql`
      SELECT id, service, amount_usd::text, period, started_on, ended_on, notes
      FROM fixed_costs
      ORDER BY started_on DESC
    `);
    return c.json(rows);
  });

  routes.post("/fixed-costs", async (c) => {
    const body = FixedCostInput.parse(await c.req.json());
    await deps.db.execute(sql`
      INSERT INTO fixed_costs (service, amount_usd, period, started_on, ended_on, notes)
      VALUES (${body.service}, ${body.amountUsd}, ${body.period},
              ${body.startedOn}, ${body.endedOn ?? null}, ${body.notes ?? null})
    `);
    return c.json({ ok: true }, 201);
  });

  routes.patch("/fixed-costs/:id", async (c) => {
    const id = c.req.param("id");
    const body = FixedCostInput.partial().parse(await c.req.json());
    await deps.db.execute(sql`
      UPDATE fixed_costs SET
        service     = COALESCE(${body.service ?? null},   service),
        amount_usd  = COALESCE(${body.amountUsd ?? null}, amount_usd),
        period      = COALESCE(${body.period ?? null},    period),
        started_on  = COALESCE(${body.startedOn ?? null}, started_on),
        ended_on    = ${body.endedOn ?? null},
        notes       = COALESCE(${body.notes ?? null},     notes)
      WHERE id = ${id}
    `);
    return c.json({ ok: true });
  });

  routes.delete("/fixed-costs/:id", async (c) => {
    const id = c.req.param("id");
    await deps.db.execute(sql`DELETE FROM fixed_costs WHERE id = ${id}`);
    return c.json({ ok: true });
  });

  routes.get("/upfront-costs", async (c) => {
    const rows = await deps.db.execute(sql`
      SELECT id, label, amount_usd::text, paid_on, amortize_months, notes
      FROM upfront_costs
      ORDER BY paid_on DESC
    `);
    return c.json(rows);
  });

  routes.post("/upfront-costs", async (c) => {
    const body = UpfrontCostInput.parse(await c.req.json());
    await deps.db.execute(sql`
      INSERT INTO upfront_costs (label, amount_usd, paid_on, amortize_months, notes)
      VALUES (${body.label}, ${body.amountUsd}, ${body.paidOn},
              ${body.amortizeMonths ?? null}, ${body.notes ?? null})
    `);
    return c.json({ ok: true }, 201);
  });

  routes.delete("/upfront-costs/:id", async (c) => {
    const id = c.req.param("id");
    await deps.db.execute(sql`DELETE FROM upfront_costs WHERE id = ${id}`);
    return c.json({ ok: true });
  });

  return routes;
}

const RateCardInput = z.object({
  provider: z.string().min(1),
  operation: z.string().min(1),
  unitType: z.string().min(1),
  pricePerUnit: z.string().regex(/^\d+(\.\d+)?$/),
  notes: z.string().optional(),
});

const FixedCostInput = z.object({
  service: z.string().min(1),
  amountUsd: z.string().regex(/^\d+(\.\d+)?$/),
  period: z.enum(["monthly", "yearly"]),
  startedOn: z.string(), // YYYY-MM-DD
  endedOn: z.string().nullable().optional(),
  notes: z.string().optional(),
});

const UpfrontCostInput = z.object({
  label: z.string().min(1),
  amountUsd: z.string().regex(/^\d+(\.\d+)?$/),
  paidOn: z.string(),
  amortizeMonths: z.number().int().nullable().optional(),
  notes: z.string().optional(),
});
