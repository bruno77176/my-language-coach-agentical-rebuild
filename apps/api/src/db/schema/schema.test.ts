import { describe, expect, it } from "vitest";
import * as schema from "./index";

describe("db schema", () => {
  it("exports all 9 tables", () => {
    expect(schema.profiles).toBeDefined();
    expect(schema.conversations).toBeDefined();
    expect(schema.messages).toBeDefined();
    expect(schema.topics).toBeDefined();
    expect(schema.streakDays).toBeDefined();
    expect(schema.vocabItems).toBeDefined();
    expect(schema.entitlements).toBeDefined();
    expect(schema.pushTokens).toBeDefined();
    expect(schema.waitlist).toBeDefined();
  });
});
