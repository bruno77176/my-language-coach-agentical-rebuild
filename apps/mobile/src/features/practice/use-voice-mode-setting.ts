import { useEffect } from "react";
import { create } from "zustand";
import {
  getVoiceMode,
  setVoiceMode as persist,
  type VoiceMode,
} from "./voice-mode";

// Shared, reactive voice-mode setting. A zustand store (not per-component
// state) so toggling the mode on the chooser is immediately reflected by the
// Practice screen's branch — otherwise each component held its own stale copy.
type VoiceModeState = {
  mode: VoiceMode;
  loaded: boolean;
  hydrate: () => Promise<void>;
  setMode: (m: VoiceMode) => Promise<void>;
};

const useStore = create<VoiceModeState>((set, get) => ({
  mode: "push_to_talk",
  loaded: false,
  hydrate: async () => {
    if (get().loaded) return;
    const m = await getVoiceMode();
    set({ mode: m, loaded: true });
  },
  setMode: async (m) => {
    set({ mode: m });
    await persist(m);
  },
}));

export function useVoiceModeSetting() {
  const mode = useStore((s) => s.mode);
  const loaded = useStore((s) => s.loaded);
  const setMode = useStore((s) => s.setMode);
  const hydrate = useStore((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  return { mode, setMode, loaded };
}
