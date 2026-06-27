import { describe, it, expect } from "vitest";
import {
  MemoryItemCandidateListSchema,
  LessonPlanSchema,
} from "./memory-items-schema";

describe("memory item candidate schema", () => {
  it("accepts a valid candidate list", () => {
    const out = MemoryItemCandidateListSchema.parse([
      { type: "mistake", content: "uses 'meine Niveau' (should be 'mein')" },
      { type: "persona_detail", content: "has a partner; they want children" },
    ]);
    expect(out).toHaveLength(2);
  });
  it("rejects an unknown type", () => {
    expect(() =>
      MemoryItemCandidateListSchema.parse([{ type: "nope", content: "x" }]),
    ).toThrow();
  });
  it("parses a lesson plan", () => {
    const p = LessonPlanSchema.parse({
      focus: "dative prepositions",
      target_structures: ["mit + dative"],
      suggested_topics: ["cooking"],
      callbacks: ["their trip to Berlin"],
    });
    expect(p.focus).toBe("dative prepositions");
  });
});
