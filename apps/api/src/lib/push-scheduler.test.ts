import { describe, expect, it } from "vitest";
import { bodyFor, computeDay1At } from "./push-scheduler";

describe("computeDay1At", () => {
  it("returns approximately 9am local time the day after now", () => {
    const now = new Date("2026-06-01T15:00:00Z");
    const day1 = computeDay1At(now, "America/New_York");
    // Day after June 1, 2026 in NY → June 2; constructed at 09:00 local naively
    expect(day1.getUTCFullYear()).toBe(2026);
    expect(day1.getUTCMonth()).toBe(5); // June
    expect(day1.getUTCDate()).toBe(2);
  });
});

describe("bodyFor", () => {
  it("returns title + body + deep-link for each kind", () => {
    expect(bodyFor("day-1-feedback").title).toContain("first feedback");
    expect(bodyFor("day-1-feedback").data!.url).toBe(
      "mylanguagecoach:///(tabs)/practice",
    );
    expect(bodyFor("day-2-warmup").body).toContain("warmup");
    expect(bodyFor("day-2-warmup").data!.url).toBe(
      "mylanguagecoach:///(tabs)/practice",
    );
    expect(bodyFor("day-7-summary").data!.url).toBe(
      "mylanguagecoach:///(tabs)/progress/weekly-summary",
    );
  });
});
