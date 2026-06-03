import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_TTS_CONFIG, type TtsConfig } from "@language-coach/shared";

type VoiceState = {
  // The picked voice always applies to live conversations.
  config: TtsConfig;
  setConfig: (patch: Partial<TtsConfig>) => void;
  reset: () => void;
};

export const useVoiceLab = create<VoiceState>()(
  persist(
    (set) => ({
      config: DEFAULT_TTS_CONFIG,
      setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
      reset: () => set({ config: DEFAULT_TTS_CONFIG }),
    }),
    {
      // Keep the v1 key: the now-absent `overrideEnabled` field in any persisted
      // blob is simply ignored by zustand on rehydrate.
      name: "voice-lab.v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
