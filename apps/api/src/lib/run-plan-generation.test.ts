/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import { runPlanGeneration } from "./run-plan-generation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_PLAN_JSON = JSON.stringify({
  focus: "dative prepositions",
  target_structures: ["mit + dative"],
  suggested_topics: ["cooking"],
  callbacks: ["their dog Rex"],
});

/** Fake OpenAI client whose chat.completions.create resolves with content. */
function makeOpenAI(responseContent: string) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: responseContent } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
      },
    },
  } as any;
}

/**
 * Fake db that covers both selectMemoryForPrompt (query.memoryItems.findMany)
 * and runPlanGeneration itself (query.coachMemory.findFirst + update).
 */
function makeDb(options: { coachMemoryRow?: any; memoryItems?: any[] }) {
  const { coachMemoryRow = null, memoryItems = [] } = options;

  const whereMock = vi.fn().mockResolvedValue(undefined);
  const setMock = vi.fn().mockReturnValue({ where: whereMock });

  return {
    /** Expose for assertions */
    _setMock: setMock,
    _whereMock: whereMock,
    query: {
      coachMemory: {
        findFirst: vi.fn().mockResolvedValue(coachMemoryRow),
      },
      memoryItems: {
        findMany: vi.fn().mockResolvedValue(memoryItems),
      },
    },
    update: vi.fn().mockReturnValue({ set: setMock }),
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("runPlanGeneration", () => {
  it("persists nextPlan and nextPlanGeneratedAt when items are present and plan is valid", async () => {
    const db = makeDb({
      coachMemoryRow: { proficiencyLevel: "B1" },
      memoryItems: [{ type: "mistake", content: "dative wrong" }],
    });
    const openai = makeOpenAI(VALID_PLAN_JSON);

    await runPlanGeneration(db, openai, { userId: "u1", languageCode: "de" });

    // db.update should have been called once
    expect(db.update).toHaveBeenCalledOnce();
    // .set() should include nextPlan with the parsed focus text
    expect(db._setMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nextPlan: expect.objectContaining({ focus: "dative prepositions" }),
        nextPlanGeneratedAt: expect.any(Date),
      }),
    );
  });

  it("does NOT call generateLessonPlan or update when items list is empty", async () => {
    const db = makeDb({
      coachMemoryRow: { proficiencyLevel: "A1" },
      memoryItems: [],
    });
    const openai = makeOpenAI(VALID_PLAN_JSON);

    await runPlanGeneration(db, openai, { userId: "u1", languageCode: "de" });

    // generateLessonPlan would call openai.chat.completions.create — it must not
    expect(openai.chat.completions.create).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("does NOT update when generateLessonPlan returns null (unparseable JSON)", async () => {
    const db = makeDb({
      coachMemoryRow: null,
      memoryItems: [{ type: "fact", content: "likes cooking" }],
    });
    // Return garbage so JSON.parse inside generateLessonPlan fails → null
    const openai = makeOpenAI("this is not valid json");

    await runPlanGeneration(db, openai, { userId: "u1", languageCode: "de" });

    expect(openai.chat.completions.create).toHaveBeenCalledOnce();
    expect(db.update).not.toHaveBeenCalled();
  });

  it("calls onUsage when plan is generated", async () => {
    const db = makeDb({
      coachMemoryRow: { proficiencyLevel: "B1" },
      memoryItems: [{ type: "mistake", content: "dative wrong" }],
    });
    const openai = makeOpenAI(VALID_PLAN_JSON);
    const onUsageSpy = vi.fn();

    await runPlanGeneration(
      db,
      openai,
      { userId: "u1", languageCode: "de" },
      onUsageSpy,
    );

    expect(onUsageSpy).toHaveBeenCalled();
  });

  it("works without onUsage (backward compat)", async () => {
    const db = makeDb({
      coachMemoryRow: { proficiencyLevel: "B1" },
      memoryItems: [{ type: "mistake", content: "dative wrong" }],
    });
    const openai = makeOpenAI(VALID_PLAN_JSON);

    // Should not throw
    await expect(
      runPlanGeneration(db, openai, { userId: "u1", languageCode: "de" }),
    ).resolves.toBeUndefined();
  });
});
