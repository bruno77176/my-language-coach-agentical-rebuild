import { sql, type SQL } from "drizzle-orm";
import type { Database } from "../db";

export type Filters = {
  from: Date;
  to: Date;
  platform?: string; // 'ios' | 'android' | 'web' | 'server'
  service?: string; // provider OR fixed_costs.service value
  userId?: string;
};

// ---- helpers ----

function buildVariableWhere(f: Filters, alias?: string): SQL {
  // postgres-js can't bind a JS Date directly when drizzle hands params through
  // db.execute(sql`...`) — it ends up at Buffer.byteLength which rejects Date.
  // Serialize to ISO so the driver gets a plain string and PG casts it back.
  //
  // `alias` qualifies column refs (e.g. "c.day") when the caller JOINs another
  // table that also has overlapping column names. Drizzle's sql template
  // doesn't safely interpolate identifiers, so we whitelist a-z to be safe.
  const safe = alias && /^[a-z][a-z0-9_]*$/i.test(alias) ? alias : "";
  const day = sql.raw(safe ? `${safe}.day` : "day");
  const platform = sql.raw(safe ? `${safe}.platform` : "platform");
  const provider = sql.raw(safe ? `${safe}.provider` : "provider");
  const userId = sql.raw(safe ? `${safe}.user_id` : "user_id");
  const parts: SQL[] = [
    sql`${day} >= ${f.from.toISOString()}`,
    sql`${day} < ${f.to.toISOString()}`,
  ];
  if (f.platform) parts.push(sql`${platform} = ${f.platform}`);
  if (f.service) parts.push(sql`${provider} = ${f.service}`);
  if (f.userId) parts.push(sql`${userId} = ${f.userId}`);
  return parts.reduce((acc, p, i) => (i === 0 ? p : sql`${acc} AND ${p}`));
}

// ---- pure pro-rate / amortize math (no DB) ----

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Fractional months between two dates, using calendar months plus a 30-day
// approximation for the day fraction. monthsBetween(may-01, jun-01) === 1.
function monthsBetween(a: Date, b: Date): number {
  const yearDiff = b.getUTCFullYear() - a.getUTCFullYear();
  const monthDiff = b.getUTCMonth() - a.getUTCMonth();
  const dayDiff = (b.getUTCDate() - a.getUTCDate()) / 30;
  return yearDiff * 12 + monthDiff + dayDiff;
}

export function prorateFixedCost(args: {
  amountUsd: number;
  period: "monthly" | "yearly";
  startedOn: Date;
  endedOn: Date | null;
  windowFrom: Date;
  windowTo: Date;
}): number {
  // ended_on is stored as DATE and means "service was active through this day"
  // (inclusive). Convert to an exclusive upper bound by adding one day.
  const effectiveEnd = args.endedOn
    ? new Date(args.endedOn.getTime() + MS_PER_DAY)
    : new Date("2999-01-01");
  const start = Math.max(args.startedOn.getTime(), args.windowFrom.getTime());
  const end = Math.min(effectiveEnd.getTime(), args.windowTo.getTime());
  if (end <= start) return 0;
  const days = (end - start) / MS_PER_DAY;
  const daysPerPeriod = args.period === "yearly" ? 365 : 30;
  // Cap at one full period so a 31-day month doesn't over-bill a monthly fee.
  const billableDays = Math.min(days, daysPerPeriod);
  return (args.amountUsd * billableDays) / daysPerPeriod;
}

export function amortizeUpfrontCost(args: {
  amountUsd: number;
  paidOn: Date;
  amortizeMonths: number | null;
  windowFrom: Date;
  windowTo: Date;
}): number {
  if (args.amortizeMonths === null || args.amortizeMonths === 0) {
    return args.paidOn >= args.windowFrom && args.paidOn < args.windowTo
      ? args.amountUsd
      : 0;
  }
  // Amortize evenly across calendar months. A 1-month window always gets
  // amountUsd / amortizeMonths regardless of how many days the month has.
  const amortStart = args.paidOn;
  const amortEnd = new Date(args.paidOn);
  amortEnd.setUTCMonth(amortEnd.getUTCMonth() + args.amortizeMonths);
  const overlapStartMs = Math.max(
    amortStart.getTime(),
    args.windowFrom.getTime(),
  );
  const overlapEndMs = Math.min(amortEnd.getTime(), args.windowTo.getTime());
  if (overlapEndMs <= overlapStartMs) return 0;
  const overlapMonths = monthsBetween(
    new Date(overlapStartMs),
    new Date(overlapEndMs),
  );
  return (args.amountUsd * overlapMonths) / args.amortizeMonths;
}

// ---- public query functions ----

export type Overview = {
  variableCostUsd: number;
  fixedCostUsd: number;
  upfrontCostUsd: number;
  totalCostUsd: number;
  activeUsers: number;
  eventCount: number;
  costPerActiveUser: number;
};

export async function getOverview(db: Database, f: Filters): Promise<Overview> {
  const variableRows = (await db.execute(sql`
    SELECT
      COALESCE(SUM(cost_usd), 0)::text AS variable_cost,
      COUNT(DISTINCT user_id)::int      AS active_users,
      COALESCE(SUM(event_count), 0)::int AS event_count
    FROM daily_cost_by_user
    WHERE ${buildVariableWhere(f)}
  `)) as unknown as Array<{
    variable_cost: string;
    active_users: number;
    event_count: number;
  }>;
  const v = variableRows[0] ?? {
    variable_cost: "0",
    active_users: 0,
    event_count: 0,
  };
  const variableCostUsd = Number(v.variable_cost);

  // Per spec: when filtering by user, hide infra (it's not attributable).
  if (f.userId) {
    return {
      variableCostUsd,
      fixedCostUsd: 0,
      upfrontCostUsd: 0,
      totalCostUsd: variableCostUsd,
      activeUsers: v.active_users,
      eventCount: v.event_count,
      costPerActiveUser: v.active_users ? variableCostUsd / v.active_users : 0,
    };
  }

  // Fixed costs in window (optionally filtered by service)
  const fixedRows = (await db.execute(sql`
    SELECT id, service, amount_usd::text, period, started_on, ended_on
    FROM fixed_costs
    WHERE ${f.service ? sql`service = ${f.service} AND` : sql``}
          started_on < ${f.to.toISOString()}
      AND (ended_on IS NULL OR ended_on > ${f.from.toISOString()})
  `)) as unknown as Array<{
    id: string;
    service: string;
    amount_usd: string;
    period: "monthly" | "yearly";
    started_on: string;
    ended_on: string | null;
  }>;
  const fixedCostUsd = fixedRows.reduce(
    (acc, r) =>
      acc +
      prorateFixedCost({
        amountUsd: Number(r.amount_usd),
        period: r.period,
        startedOn: new Date(r.started_on),
        endedOn: r.ended_on ? new Date(r.ended_on) : null,
        windowFrom: f.from,
        windowTo: f.to,
      }),
    0,
  );

  // Upfront costs (no service filter — they're cross-cutting)
  const upfrontRows = f.service
    ? []
    : ((await db.execute(sql`
        SELECT id, amount_usd::text, paid_on, amortize_months
        FROM upfront_costs
      `)) as unknown as Array<{
        id: string;
        amount_usd: string;
        paid_on: string;
        amortize_months: number | null;
      }>);
  const upfrontCostUsd = upfrontRows.reduce(
    (acc, r) =>
      acc +
      amortizeUpfrontCost({
        amountUsd: Number(r.amount_usd),
        paidOn: new Date(r.paid_on),
        amortizeMonths: r.amortize_months,
        windowFrom: f.from,
        windowTo: f.to,
      }),
    0,
  );

  const totalCostUsd = variableCostUsd + fixedCostUsd + upfrontCostUsd;
  return {
    variableCostUsd,
    fixedCostUsd,
    upfrontCostUsd,
    totalCostUsd,
    activeUsers: v.active_users,
    eventCount: v.event_count,
    costPerActiveUser: v.active_users ? totalCostUsd / v.active_users : 0,
  };
}

export type ServiceRow = {
  service: string;
  costUsd: number;
  units: number;
  eventCount: number;
};

export async function getByService(
  db: Database,
  f: Filters,
): Promise<ServiceRow[]> {
  const rows = (await db.execute(sql`
    SELECT provider AS service,
           SUM(cost_usd)::text AS cost,
           SUM(units)::text    AS units,
           SUM(event_count)::int AS event_count
    FROM daily_cost_by_user
    WHERE ${buildVariableWhere(f)}
    GROUP BY provider
    ORDER BY SUM(cost_usd) DESC
  `)) as unknown as Array<{
    service: string;
    cost: string;
    units: string;
    event_count: number;
  }>;
  return rows.map((r) => ({
    service: r.service,
    costUsd: Number(r.cost),
    units: Number(r.units),
    eventCount: r.event_count,
  }));
}

export type PlatformRow = {
  platform: string;
  costUsd: number;
  eventCount: number;
};

export async function getByPlatform(
  db: Database,
  f: Filters,
): Promise<PlatformRow[]> {
  const rows = (await db.execute(sql`
    SELECT platform,
           SUM(cost_usd)::text AS cost,
           SUM(event_count)::int AS event_count
    FROM daily_cost_by_user
    WHERE ${buildVariableWhere(f)}
    GROUP BY platform
    ORDER BY SUM(cost_usd) DESC
  `)) as unknown as Array<{
    platform: string;
    cost: string;
    event_count: number;
  }>;
  return rows.map((r) => ({
    platform: r.platform,
    costUsd: Number(r.cost),
    eventCount: r.event_count,
  }));
}

export type UserRow = {
  userId: string | null;
  email: string | null;
  displayName: string | null;
  costUsd: number;
  eventCount: number;
  lastSeenAt: Date | null;
};

export async function getByUser(db: Database, f: Filters): Promise<UserRow[]> {
  // LEFT JOIN profiles + auth.users so the dashboard can show email +
  // displayName instead of just a UUID prefix. unattributed rows (user_id
  // NULL) keep their null email/displayName and render as "unattributed".
  const rows = (await db.execute(sql`
    SELECT c.user_id,
           u.email AS email,
           p.display_name AS display_name,
           SUM(c.cost_usd)::text AS cost,
           SUM(c.event_count)::int AS event_count,
           MAX(c.day) AS last_seen
    FROM daily_cost_by_user c
    LEFT JOIN profiles p ON p.user_id = c.user_id
    LEFT JOIN auth.users u ON u.id = c.user_id
    WHERE ${buildVariableWhere(f, "c")}
    GROUP BY c.user_id, u.email, p.display_name
    ORDER BY SUM(c.cost_usd) DESC
    LIMIT 200
  `)) as unknown as Array<{
    user_id: string | null;
    email: string | null;
    display_name: string | null;
    cost: string;
    event_count: number;
    last_seen: Date | null;
  }>;
  return rows.map((r) => ({
    userId: r.user_id,
    email: r.email,
    displayName: r.display_name,
    costUsd: Number(r.cost),
    eventCount: r.event_count,
    lastSeenAt: r.last_seen,
  }));
}

export type TimeseriesPoint = {
  day: string; // ISO date
  service: string;
  costUsd: number;
};

export async function getTimeseries(
  db: Database,
  f: Filters,
): Promise<TimeseriesPoint[]> {
  const rows = (await db.execute(sql`
    SELECT to_char(day, 'YYYY-MM-DD') AS day,
           provider AS service,
           SUM(cost_usd)::text AS cost
    FROM daily_cost_by_user
    WHERE ${buildVariableWhere(f)}
    GROUP BY day, provider
    ORDER BY day ASC
  `)) as unknown as Array<{
    day: string;
    service: string;
    cost: string;
  }>;
  return rows.map((r) => ({
    day: r.day,
    service: r.service,
    costUsd: Number(r.cost),
  }));
}
