import { sql } from "drizzle-orm";
import type { Database } from "../db";
import { reportError } from "./sentry";

export type LookupArgs = {
  provider: string;
  operation: string;
  unitType: string;
  at?: Date;
};

export type RateCardRow = {
  id: string;
  provider: string;
  operation: string;
  unitType: string;
  pricePerUnit: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

// In-process cache (5 min TTL). Rate cards change rarely; per-call DB lookup is
// wasted work. Cache key includes (provider, operation, unitType).
type CacheEntry = { card: RateCardRow | null; cachedAt: number };
const CACHE_TTL_MS = 5 * 60 * 1000;
let rateCardCache = new Map<string, CacheEntry>();

export function __setRateCardCache(c: Map<string, CacheEntry>) {
  rateCardCache = c;
}

function cacheKey(a: LookupArgs): string {
  return `${a.provider}|${a.operation}|${a.unitType}`;
}

export async function lookupRateCard(
  db: Database,
  args: LookupArgs,
): Promise<RateCardRow | null> {
  const key = cacheKey(args);
  const hit = rateCardCache.get(key);
  if (hit && Date.now() - hit.cachedAt < CACHE_TTL_MS) return hit.card;

  const at = args.at ?? new Date();
  const rows = (await db.execute(sql`
    SELECT id, provider, operation, unit_type, price_per_unit,
           effective_from, effective_to
    FROM rate_cards
    WHERE provider = ${args.provider}
      AND operation = ${args.operation}
      AND unit_type = ${args.unitType}
      AND effective_from <= ${at}
      AND (effective_to IS NULL OR effective_to > ${at})
    ORDER BY effective_from DESC
    LIMIT 1
  `)) as unknown as Array<{
    id: string;
    provider: string;
    operation: string;
    unit_type: string;
    price_per_unit: string;
    effective_from: Date;
    effective_to: Date | null;
  }>;

  const row = rows[0];
  const card: RateCardRow | null = row
    ? {
        id: row.id,
        provider: row.provider,
        operation: row.operation,
        unitType: row.unit_type,
        pricePerUnit: row.price_per_unit,
        effectiveFrom: row.effective_from,
        effectiveTo: row.effective_to,
      }
    : null;

  rateCardCache.set(key, { card, cachedAt: Date.now() });
  return card;
}

export type RecordUsageInput = {
  userId: string | null;
  platform: string; // 'ios' | 'android' | 'web' | 'server' | 'unknown'
  provider: string;
  operation: string;
  units: number;
  unitType: string;
  conversationId?: string | null;
  meta?: Record<string, unknown>;
};

export async function recordUsage(
  db: Database,
  input: RecordUsageInput,
): Promise<void> {
  try {
    const card = await lookupRateCard(db, {
      provider: input.provider,
      operation: input.operation,
      unitType: input.unitType,
    });

    if (!card) {
      // No rate card configured. Surface but don't block: caller already got
      // their provider response. The dashboard will show this gap to Bruno.
      console.warn(
        `[cost-recording] no rate card for ${input.provider}/${input.operation}/${input.unitType}`,
      );
      return;
    }

    const costUsd = Number(input.units) * Number(card.pricePerUnit);

    await db.execute(sql`
      INSERT INTO usage_events
        (user_id, platform, provider, operation, units, unit_type,
         cost_usd, rate_card_id, conversation_id, meta)
      VALUES
        (${input.userId},
         ${input.platform},
         ${input.provider},
         ${input.operation},
         ${input.units},
         ${input.unitType},
         ${costUsd},
         ${card.id},
         ${input.conversationId ?? null},
         ${input.meta ? JSON.stringify(input.meta) : null}::jsonb)
    `);
  } catch (err) {
    reportError(err as Error, {
      where: "recordUsage",
      input: { provider: input.provider, operation: input.operation },
    });
  }
}
