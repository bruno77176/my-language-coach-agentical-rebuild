import { Hono } from "hono";
import { z } from "zod";
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
  return routes;
}
