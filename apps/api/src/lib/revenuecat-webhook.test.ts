import { describe, expect, it, vi } from "vitest";
import { applyRevenueCatEvent } from "./revenuecat-webhook";

describe("applyRevenueCatEvent", () => {
  it("upgrades on INITIAL_PURCHASE", async () => {
    const where = vi.fn();
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const db = { update } as never;
    await applyRevenueCatEvent(db, {
      type: "INITIAL_PURCHASE",
      app_user_id: "u1",
      expiration_at_ms: Date.now() + 86400000,
    });
    expect(update).toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "pro" }),
    );
  });

  it("downgrades on CANCELLATION", async () => {
    const where = vi.fn();
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const db = { update } as never;
    await applyRevenueCatEvent(db, {
      type: "CANCELLATION",
      app_user_id: "u1",
    });
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ plan: "free", proUntil: null }),
    );
  });

  it("no-ops on unknown event types", async () => {
    const where = vi.fn();
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const db = { update } as never;
    await applyRevenueCatEvent(db, {
      type: "TEST",
      app_user_id: "u1",
    });
    expect(update).not.toHaveBeenCalled();
  });
});
