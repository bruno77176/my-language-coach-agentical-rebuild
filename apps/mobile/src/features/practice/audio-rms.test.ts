import { describe, expect, it } from "vitest";
import { isLikelySilent } from "./audio-rms";

describe("isLikelySilent", () => {
  it("returns true for very short duration (< 500ms)", () => {
    expect(isLikelySilent({ durationMs: 200, fileSizeBytes: 5000 })).toBe(true);
  });

  it("returns true for very small file (< 2KB)", () => {
    expect(isLikelySilent({ durationMs: 1000, fileSizeBytes: 1500 })).toBe(
      true,
    );
  });

  it("returns false for normal audio", () => {
    expect(isLikelySilent({ durationMs: 2000, fileSizeBytes: 20000 })).toBe(
      false,
    );
  });

  it("handles missing duration gracefully (treated as not silent)", () => {
    expect(
      isLikelySilent({ durationMs: undefined, fileSizeBytes: 10000 }),
    ).toBe(false);
  });
});
