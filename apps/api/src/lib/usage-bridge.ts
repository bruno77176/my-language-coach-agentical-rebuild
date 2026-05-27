// Bridges provider `onUsage` callbacks → `recordUsage` writes.
//
// Per-request factory: each route handler builds an `onUsage` bound to the
// current request's `(userId, platform, conversationId)`. The provider call
// invokes the callback exactly once on success; the callback fire-and-forgets
// one (or two, when both input + output tokens are present) `recordUsage`
// inserts into Postgres.

import type { Database } from "../db";
import type { OnUsage, UsageReport } from "../providers/usage";
import { recordUsage } from "./cost-recording";

export type UsageCtx = {
  userId: string | null;
  platform: string; // 'ios' | 'android' | 'web' | 'server' | 'unknown'
  conversationId?: string | null;
};

export function makeOnUsage(db: Database, ctx: UsageCtx): OnUsage {
  return (report: UsageReport) => {
    // Pick the primary unit (in priority order: input_tokens → output_tokens →
    // characters → seconds). When both input + output tokens are present we
    // emit a second usage_events row for the output side. The rate-card seed
    // (Task 4) has separate rows keyed on `input_tokens` and `output_tokens`
    // for chat operations, matching this split.
    const hasInput = report.inputTokens !== undefined;
    const hasOutput = report.outputTokens !== undefined;
    const hasChars = report.characters !== undefined;
    const hasSeconds = report.seconds !== undefined;

    let units = 0;
    let unitType = "input_tokens";
    if (hasInput) {
      units = report.inputTokens!;
      unitType = "input_tokens";
    } else if (hasOutput) {
      units = report.outputTokens!;
      unitType = "output_tokens";
    } else if (hasChars) {
      units = report.characters!;
      unitType = "characters";
    } else if (hasSeconds) {
      units = report.seconds!;
      unitType = "seconds";
    }

    void recordUsage(db, {
      userId: ctx.userId,
      platform: ctx.platform,
      provider: report.provider,
      operation: report.operation,
      units,
      unitType,
      conversationId: ctx.conversationId ?? null,
    });

    // Split: emit a second row for output_tokens when both are present.
    if (hasInput && hasOutput) {
      void recordUsage(db, {
        userId: ctx.userId,
        platform: ctx.platform,
        provider: report.provider,
        operation: report.operation,
        units: report.outputTokens!,
        unitType: "output_tokens",
        conversationId: ctx.conversationId ?? null,
      });
    }
  };
}

export function platformFromHeader(headerValue: string | undefined): string {
  if (!headerValue) return "unknown";
  const normalized = headerValue.toLowerCase().trim();
  if (
    normalized === "ios" ||
    normalized === "android" ||
    normalized === "web" ||
    normalized === "server"
  ) {
    return normalized;
  }
  return "unknown";
}
