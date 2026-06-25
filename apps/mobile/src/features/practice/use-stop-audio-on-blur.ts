import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { resumePlayback, stopAllPlayback } from "./audio-controller";

/**
 * Stop all audio the moment this screen loses focus, and re-enable playback
 * when it regains focus. Mirrors the Practice screen's own focus handling so
 * any other screen that plays sound (vocab review, voice lab, …) doesn't keep
 * audio running after the user navigates away (BRU-16).
 */
export function useStopAudioOnBlur(): void {
  useFocusEffect(
    useCallback(() => {
      resumePlayback();
      return () => stopAllPlayback();
    }, []),
  );
}
