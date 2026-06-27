import { describe, it, expect } from "vitest";
import { cosineSimilarity, planConsolidation } from "./consolidate-memory";

describe("cosineSimilarity", () => {
  it("is 1 for identical vectors and ~0 for orthogonal", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
});

describe("planConsolidation", () => {
  it("bumps salience when a same-type near-duplicate exists", () => {
    const decisions = planConsolidation(
      [{ type: "mistake", content: "x", embedding: [1, 0] }],
      [{ id: "e1", type: "mistake", embedding: [0.99, 0.01], salience: 0.5 }],
      { threshold: 0.86 },
    );
    expect(decisions).toEqual([
      { kind: "bump", existingId: "e1", newSalience: 0.6, candidateIndex: 0 },
    ]);
  });
  it("inserts when no same-type match clears the threshold", () => {
    const decisions = planConsolidation(
      [{ type: "fact", content: "x", embedding: [1, 0] }],
      [{ id: "e1", type: "mistake", embedding: [1, 0], salience: 0.5 }],
    );
    expect(decisions).toEqual([{ kind: "insert", candidateIndex: 0 }]);
  });
  it("inserts candidates with no embedding", () => {
    const decisions = planConsolidation(
      [{ type: "fact", content: "x", embedding: null }],
      [{ id: "e1", type: "fact", embedding: [1, 0], salience: 0.5 }],
    );
    expect(decisions).toEqual([{ kind: "insert", candidateIndex: 0 }]);
  });
});
