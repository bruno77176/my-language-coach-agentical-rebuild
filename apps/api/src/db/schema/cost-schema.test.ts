import { describe, expect, it } from "vitest";
import {
  usageEvents,
  rateCards,
  fixedCosts,
  upfrontCosts,
  revenueEvents,
} from "./index";

describe("cost-tracking schema", () => {
  it("exports all five tables", () => {
    expect(usageEvents).toBeDefined();
    expect(rateCards).toBeDefined();
    expect(fixedCosts).toBeDefined();
    expect(upfrontCosts).toBeDefined();
    expect(revenueEvents).toBeDefined();
  });

  it("usageEvents has cost-relevant columns", () => {
    const cols = Object.keys(usageEvents);
    for (const c of [
      "id",
      "createdAt",
      "userId",
      "platform",
      "provider",
      "operation",
      "units",
      "unitType",
      "costUsd",
      "rateCardId",
      "conversationId",
      "meta",
    ]) {
      expect(cols).toContain(c);
    }
  });
});
