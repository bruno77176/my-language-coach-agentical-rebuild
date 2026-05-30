import { describe, expect, it } from "vitest";
import { SessionFeedbackSchema } from "./feedback-schema";

describe("SessionFeedbackSchema", () => {
  it("accepts the empty shape", () => {
    expect(() =>
      SessionFeedbackSchema.parse({
        highlights: [],
        corrections: [],
        vocab: [],
      }),
    ).not.toThrow();
  });
  it("rejects extra root keys", () => {
    expect(() =>
      SessionFeedbackSchema.parse({
        highlights: [],
        corrections: [],
        vocab: [],
        bonus: "no",
      }),
    ).toThrow();
  });
});
