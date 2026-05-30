import { describe, expect, it, vi } from "vitest";
import { extractMemory } from "./extract-memory";
import { emptyCoachMemory } from "@language-coach/shared";

const okClient = {
  chat: {
    completions: {
      create: vi.fn().mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                proficiency_level: "B1",
                recent_topics: [
                  { topic: "trip to Italy", last_practiced_at: "2026-05-30T10:00:00.000Z" },
                ],
                weak_areas: ["past tense irregulars"],
                personal_context: { job: "engineer" },
                last_session_summary: "Talked about an upcoming trip.",
              }),
            },
          },
        ],
        usage: { prompt_tokens: 200, completion_tokens: 80 },
      }),
    },
  },
};

describe("extractMemory", () => {
  it("returns parsed memory on a happy-path completion", async () => {
    const out = await extractMemory(okClient as any, {
      existingMemory: emptyCoachMemory(),
      transcript: [
        { role: "user", text: "I'm planning a trip to Italy" },
        { role: "coach", text: "How exciting! Where in Italy?" },
      ],
      languageCode: "it",
    });
    expect(out).not.toBeNull();
    expect(out!.proficiency_level).toBe("B1");
    expect(out!.recent_topics[0]!.topic).toBe("trip to Italy");
  });

  it("returns null when the model returns invalid JSON", async () => {
    const badClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: "not json at all" } }],
            usage: { prompt_tokens: 50, completion_tokens: 10 },
          }),
        },
      },
    };
    const out = await extractMemory(badClient as any, {
      existingMemory: emptyCoachMemory(),
      transcript: [{ role: "user", text: "hi" }],
      languageCode: "it",
    });
    expect(out).toBeNull();
  });

  it("returns null when the model returns extra fields", async () => {
    const strictClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    proficiency_level: "B1",
                    recent_topics: [],
                    weak_areas: [],
                    personal_context: {},
                    last_session_summary: null,
                    rogue_field: "boom",
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 50, completion_tokens: 20 },
          }),
        },
      },
    };
    const out = await extractMemory(strictClient as any, {
      existingMemory: emptyCoachMemory(),
      transcript: [{ role: "user", text: "hi" }],
      languageCode: "it",
    });
    expect(out).toBeNull();
  });

  it("returns null when last_practiced_at is not strict ISO 8601", async () => {
    const looseClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    proficiency_level: "B1",
                    recent_topics: [
                      { topic: "x", last_practiced_at: "2026-05-30 10:00" },
                    ],
                    weak_areas: [],
                    personal_context: {},
                    last_session_summary: null,
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 50, completion_tokens: 20 },
          }),
        },
      },
    };
    const out = await extractMemory(looseClient as any, {
      existingMemory: emptyCoachMemory(),
      transcript: [{ role: "user", text: "hi" }],
      languageCode: "it",
    });
    expect(out).toBeNull();
  });

  it("returns null when proficiency_level is an unknown enum value", async () => {
    const badEnumClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    proficiency_level: "X1",
                    recent_topics: [],
                    weak_areas: [],
                    personal_context: {},
                    last_session_summary: null,
                  }),
                },
              },
            ],
            usage: { prompt_tokens: 50, completion_tokens: 10 },
          }),
        },
      },
    };
    const out = await extractMemory(badEnumClient as any, {
      existingMemory: emptyCoachMemory(),
      transcript: [{ role: "user", text: "hi" }],
      languageCode: "it",
    });
    expect(out).toBeNull();
  });
});
