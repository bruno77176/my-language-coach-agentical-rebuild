import { describe, it, expect, vi } from "vitest";
import { runDigest } from "./run-digest";

describe("runDigest", () => {
  it("inserts new items and bumps near-duplicates", async () => {
    const insertItem = vi.fn().mockResolvedValue(undefined);
    const bumpItem = vi.fn().mockResolvedValue(undefined);
    const deps = {
      extractItems: vi.fn().mockResolvedValue([
        { type: "mistake", content: "A" },
        { type: "fact", content: "B" },
      ]),
      embed: vi.fn().mockResolvedValue([
        [1, 0],
        [0, 1],
      ]),
      getActiveItems: vi
        .fn()
        .mockResolvedValue([
          { id: "e1", type: "mistake", embedding: [1, 0], salience: 0.5 },
        ]),
      insertItem,
      bumpItem,
    };
    const res = await runDigest(
      { transcript: [{ role: "user", text: "x" }], languageCode: "de" },
      deps,
    );
    expect(res).toEqual({ inserted: 1, bumped: 1 });
    expect(bumpItem).toHaveBeenCalledWith("e1", 0.6);
    expect(insertItem).toHaveBeenCalledTimes(1);
  });
  it("no-ops when no candidates are extracted", async () => {
    const deps = {
      extractItems: vi.fn().mockResolvedValue([]),
      embed: vi.fn(),
      getActiveItems: vi.fn(),
      insertItem: vi.fn(),
      bumpItem: vi.fn(),
    };
    const res = await runDigest({ transcript: [], languageCode: "de" }, deps);
    expect(res).toEqual({ inserted: 0, bumped: 0 });
    expect(deps.embed).not.toHaveBeenCalled();
  });
});
