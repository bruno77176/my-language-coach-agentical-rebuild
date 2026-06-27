import { describe, expect, it, beforeEach } from "vitest";
import { allowRequest, __resetRateLimit } from "./rate-limit";

describe("allowRequest", () => {
  beforeEach(() => __resetRateLimit());

  it("allows up to N requests in the window, then blocks", () => {
    const t = 1000;
    expect(allowRequest("u", 3, 1000, t)).toBe(true);
    expect(allowRequest("u", 3, 1000, t)).toBe(true);
    expect(allowRequest("u", 3, 1000, t)).toBe(true);
    expect(allowRequest("u", 3, 1000, t)).toBe(false);
  });

  it("frees up once the window has passed", () => {
    expect(allowRequest("u", 1, 1000, 1000)).toBe(true);
    expect(allowRequest("u", 1, 1000, 1500)).toBe(false); // still in window
    expect(allowRequest("u", 1, 1000, 2100)).toBe(true); // window elapsed
  });

  it("tracks each key independently", () => {
    expect(allowRequest("a", 1, 1000, 1000)).toBe(true);
    expect(allowRequest("b", 1, 1000, 1000)).toBe(true);
    expect(allowRequest("a", 1, 1000, 1000)).toBe(false);
  });
});
