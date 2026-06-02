import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_TTS_CONFIG, type TtsConfig } from "@language-coach/shared";

type VoiceLabState = {
  // When false, live turns use backend defaults (production behavior).
  overrideEnabled: boolean;
  config: TtsConfig;
  setOverrideEnabled: (on: boolean) => void;
  setConfig: (patch: Partial<TtsConfig>) => void;
  reset: () => void;
};

export const useVoiceLab = create<VoiceLabState>()(
  persist(
    (set) => ({
      overrideEnabled: false,
      config: DEFAULT_TTS_CONFIG,
      setOverrideEnabled: (on) => set({ overrideEnabled: on }),
      setConfig: (patch) => set((s) => ({ config: { ...s.config, ...patch } })),
      reset: () => set({ overrideEnabled: false, config: DEFAULT_TTS_CONFIG }),
    }),
    {
      name: "voice-lab.v1",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
