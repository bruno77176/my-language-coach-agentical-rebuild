import { describe, expect, it } from "vitest";
import { identity } from "./identity";

describe("identity", () => {
  it("returns its argument unchanged", () => {
    expect(identity(42)).toBe(42);
    expect(identity("hello")).toBe("hello");
  });
});
