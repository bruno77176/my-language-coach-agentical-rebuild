import { describe, it, expect } from "vitest";
import { liveReducer, initialLiveState } from "./live-machine";

describe("liveReducer", () => {
  it("START moves idle → listening, unmuted and cleared", () => {
    const s = liveReducer(
      { ...initialLiveState, error: "x" },
      { type: "START" },
    );
    expect(s.phase).toBe("listening");
    expect(s.muted).toBe(false);
    expect(s.error).toBeNull();
  });

  it("TOGGLE_MUTE flips the muted flag without changing phase", () => {
    const s = liveReducer(
      { ...initialLiveState, phase: "listening" },
      { type: "TOGGLE_MUTE" },
    );
    expect(s.muted).toBe(true);
    expect(s.phase).toBe("listening");
    expect(liveReducer(s, { type: "TOGGLE_MUTE" }).muted).toBe(false);
  });

  it("USER_TRANSCRIPT moves to thinking and records the utterance", () => {
    const s = liveReducer(
      { ...initialLiveState, phase: "listening", coachText: "old" },
      { type: "USER_TRANSCRIPT", text: "hola" },
    );
    expect(s.phase).toBe("thinking");
    expect(s.userTranscript).toBe("hola");
    expect(s.coachText).toBe("");
  });

  it("REPLY_CHUNK moves to coachSpeaking and accumulates coach text", () => {
    let s = liveReducer(
      { ...initialLiveState, phase: "thinking" },
      { type: "REPLY_CHUNK", text: "Hola." },
    );
    expect(s.phase).toBe("coachSpeaking");
    expect(s.coachText).toBe("Hola.");
    s = liveReducer(s, { type: "REPLY_CHUNK", text: "¿Qué tal?" });
    expect(s.coachText).toBe("Hola. ¿Qué tal?");
  });

  it("TURN_DONE returns to listening", () => {
    const s = liveReducer(
      { ...initialLiveState, phase: "coachSpeaking", coachText: "hi" },
      { type: "TURN_DONE" },
    );
    expect(s.phase).toBe("listening");
  });

  it("STOP and CLOSED reset to idle", () => {
    const live = { ...initialLiveState, phase: "coachSpeaking" as const };
    expect(liveReducer(live, { type: "STOP" }).phase).toBe("idle");
    expect(liveReducer(live, { type: "CLOSED" }).phase).toBe("idle");
  });

  it("ERROR records the code without losing the phase", () => {
    const s = liveReducer(
      { ...initialLiveState, phase: "listening" },
      { type: "ERROR", code: "STT_FAIL" },
    );
    expect(s.error).toBe("STT_FAIL");
    expect(s.phase).toBe("listening");
  });
});
