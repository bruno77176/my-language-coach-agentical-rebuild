import { describe, it, expect } from "vitest";
import {
  parseLiveVoiceIds,
  canUseLiveVoice,
  allowedVoiceModes,
} from "./voice-entitlement";

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

  it("offers push-to-talk to everyone and live only to the allowlist", () => {
    expect(allowedVoiceModes("user-1", ["user-1"])).toEqual([
      "push_to_talk",
      "live",
    ]);
    expect(allowedVoiceModes("user-x", ["user-1"])).toEqual(["push_to_talk"]);
  });
});
