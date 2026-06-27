import { describe, it, expect, vi } from "vitest";
import { makeDigestDeps } from "./digest-repo";

/* eslint-disable @typescript-eslint/no-explicit-any */

function fakeDb() {
  const insertValues = vi.fn().mockResolvedValue(undefined);
  const setWhere = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where: setWhere });
  return {
    _insertValues: insertValues,
    _set: set,
    _setWhere: setWhere,
    query: {
      memoryItems: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { id: "e1", type: "mistake", embedding: [1, 0], salience: 0.7 },
          ]),
      },
    },
    insert: vi.fn().mockReturnValue({ values: insertValues }),
    update: vi.fn().mockReturnValue({ set }),
  } as any;
}

describe("makeDigestDeps", () => {
  it("maps active items and inserts/bumps via drizzle", async () => {
    const db = fakeDb();
    const deps = makeDigestDeps(db, {} as any, {
      userId: "u1",
      conversationId: "c1",
      languageCode: "de",
    });
    expect(await deps.getActiveItems()).toEqual([
      { id: "e1", type: "mistake", embedding: [1, 0], salience: 0.7 },
    ]);
    await deps.insertItem({ type: "fact", content: "B", embedding: [0, 1] });
    expect(db._insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        languageCode: "de",
        type: "fact",
        content: "B",
        embedding: [0, 1],
        sourceConversationId: "c1",
      }),
    );
    await deps.bumpItem("e1", 0.8);
    expect(db._set).toHaveBeenCalledWith(
      expect.objectContaining({ salience: 0.8 }),
    );
  });
});
