import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory AsyncStorage so the setting helpers test in the node env.
vi.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    default: {
      getItem: async (k: string) => store.get(k) ?? null,
      setItem: async (k: string, v: string) => {
        store.set(k, v);
      },
      clear: async () => {
        store.clear();
      },
    },
  };
});

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getVoiceMode, setVoiceMode } from "./voice-mode";

describe("voice-mode setting", () => {
  beforeEach(async () => {
    await (AsyncStorage as unknown as { clear: () => Promise<void> }).clear();
  });

  it("defaults to push_to_talk when nothing is stored", async () => {
    expect(await getVoiceMode()).toBe("push_to_talk");
  });

  it("round-trips a stored mode", async () => {
    await setVoiceMode("live");
    expect(await getVoiceMode()).toBe("live");
  });

  it("falls back to the default for an invalid stored value", async () => {
    await AsyncStorage.setItem("voice_mode", "garbage");
    expect(await getVoiceMode()).toBe("push_to_talk");
  });
});
