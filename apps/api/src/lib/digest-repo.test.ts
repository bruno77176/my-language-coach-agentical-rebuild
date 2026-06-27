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

  it("seeds SR fields on a mistake insert", async () => {
    const db = fakeDb();
    const deps = makeDigestDeps(db, {} as any, {
      userId: "u1",
      conversationId: "c1",
      languageCode: "de",
    });
    await deps.insertItem({
      type: "mistake",
      content: "dative wrong",
      embedding: [1, 0],
    });
    const v = db._insertValues.mock.calls[0][0];
    expect(v.srIntervalDays).toBe(1);
    expect(v.srEase).toBe(2.5);
    expect(v.dueAt).toBeInstanceOf(Date);
  });

  it("does NOT set SR fields on a non-mistake insert", async () => {
    const db = fakeDb();
    const deps = makeDigestDeps(db, {} as any, {
      userId: "u1",
      conversationId: "c1",
      languageCode: "de",
    });
    await deps.insertItem({ type: "fact", content: "B", embedding: [0, 1] });
    const v = db._insertValues.mock.calls[0][0];
    expect(v.dueAt).toBeUndefined();
    expect(v.srIntervalDays).toBeUndefined();
  });
});

describe("makeDigestDeps onUsage forwarding", () => {
  it("calls onUsage when extractItems is invoked", async () => {
    const db = fakeDb();
    const mockOpenai = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '{"items":[]}' } }],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          }),
        },
      },
    } as any;
    const onUsageSpy = vi.fn();
    const deps = makeDigestDeps(
      db,
      mockOpenai,
      { userId: "u1", conversationId: "c1", languageCode: "de" },
      onUsageSpy,
    );

    await deps.extractItems([{ role: "user", text: "x" }], "de");

    expect(onUsageSpy).toHaveBeenCalled();
  });

  it("calls onUsage when embed is invoked", async () => {
    const db = fakeDb();
    const mockOpenai = {
      embeddings: {
        create: vi.fn().mockResolvedValue({
          data: [{ index: 0, embedding: [0.1, 0.2] }],
          usage: { prompt_tokens: 1, total_tokens: 1 },
        }),
      },
    } as any;
    const onUsageSpy = vi.fn();
    const deps = makeDigestDeps(
      db,
      mockOpenai,
      { userId: "u1", conversationId: "c1", languageCode: "de" },
      onUsageSpy,
    );

    await deps.embed(["x"]);

    expect(onUsageSpy).toHaveBeenCalled();
  });

  it("works without onUsage (backward compat)", async () => {
    const db = fakeDb();
    const mockOpenai = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '{"items":[]}' } }],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          }),
        },
      },
    } as any;
    const deps = makeDigestDeps(db, mockOpenai, {
      userId: "u1",
      conversationId: "c1",
      languageCode: "de",
    });

    // Should not throw
    await expect(
      deps.extractItems([{ role: "user", text: "x" }], "de"),
    ).resolves.not.toThrow();
  });
});
