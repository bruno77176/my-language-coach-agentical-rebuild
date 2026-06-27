import { describe, it, expect } from "vitest";
import { memoryItems } from "./memory-items";
import { digestJobs } from "./digest-jobs";

describe("agentic memory schema", () => {
  it("exposes memory_items columns", () => {
    const cols = Object.keys(memoryItems);
    for (const c of [
      "id",
      "userId",
      "languageCode",
      "type",
      "content",
      "embedding",
      "salience",
      "status",
      "dueAt",
    ]) {
      expect(cols).toContain(c);
    }
  });
  it("exposes digest_jobs columns", () => {
    const cols = Object.keys(digestJobs);
    for (const c of ["id", "userId", "conversationId", "status", "attempts"]) {
      expect(cols).toContain(c);
    }
  });
});
