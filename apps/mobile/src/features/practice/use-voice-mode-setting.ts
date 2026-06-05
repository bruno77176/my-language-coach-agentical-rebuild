import { useCallback, useEffect, useState } from "react";
import { getVoiceMode, setVoiceMode, type VoiceMode } from "./voice-mode";

// Loads the persisted voice-mode setting and exposes a setter. `loaded` lets
// the caller avoid branching the Practice UI before the stored value is read.
export function useVoiceModeSetting() {
  const [mode, setModeState] = useState<VoiceMode>("push_to_talk");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void getVoiceMode().then((m) => {
      if (active) {
        setModeState(m);
        setLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const setMode = useCallback(async (m: VoiceMode) => {
    setModeState(m);
    await setVoiceMode(m);
  }, []);

  return { mode, setMode, loaded };
}
