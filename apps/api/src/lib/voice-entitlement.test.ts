import { describe, it, expect } from "vitest";
import { parseLiveVoiceIds, canUseLiveVoice } from "./voice-entitlement";

describe("voice-entitlement", () => {
  it("parses a comma-separated allowlist, trimming blanks", () => {
    expect(parseLiveVoiceIds(" a , b ,, c ")).toEqual(["a", "b", "c"]);
    expect(parseLiveVoiceIds("")).toEqual([]);
  });

  it("allows only allowlisted user ids", () => {
    const ids = ["user-1", "user-2"];
    expect(canUseLiveVoice("user-1", ids)).toBe(true);
    expect(canUseLiveVoice("user-x", ids)).toBe(false);
  });
});
