import { describe, expect, it } from "vitest";
import { buildTranscript } from "./build-transcript";

describe("buildTranscript", () => {
  it("formats a multi-turn conversation", () => {
    const out = buildTranscript({
      languageCode: "it",
      startedAt: new Date("2026-05-10T14:00:00Z"),
      durationMinutes: 6,
      messages: [
        { role: "user", text: "Buongiorno!" },
        { role: "coach", text: "Buongiorno! Come stai?" },
        { role: "user", text: "Sto bene." },
      ],
    });
    expect(out).toContain("My Language Coach — Italian practice");
    expect(out).toContain("6 min");
    expect(out).toContain("You: Buongiorno!");
    expect(out).toContain("Coach: Buongiorno! Come stai?");
    expect(out).toContain("Practice with me → https://www.mylanguagecoach.app");
  });

  it("returns a header-only transcript when there are no messages", () => {
    const out = buildTranscript({
      languageCode: "fr",
      startedAt: new Date("2026-05-10T14:00:00Z"),
      durationMinutes: 0,
      messages: [],
    });
    expect(out).toContain("French practice");
    expect(out).not.toContain("You:");
    expect(out).not.toContain("Coach:");
  });

  it("falls back to language code when name unknown", () => {
    const out = buildTranscript({
      languageCode: "xx",
      startedAt: new Date("2026-05-10T14:00:00Z"),
      durationMinutes: 1,
      messages: [{ role: "user", text: "hi" }],
    });
    expect(out).toContain("xx practice");
  });
});
