import { useEffect } from "react";
import { setAudioModeAsync, type AudioMode } from "expo-audio";

const RECORD_MODE: Partial<AudioMode> = {
  allowsRecording: true,
  playsInSilentMode: true,
  interruptionMode: "doNotMix",
  shouldPlayInBackground: false,
};

const PLAYBACK_MODE: Partial<AudioMode> = {
  allowsRecording: false,
  playsInSilentMode: true,
  interruptionMode: "doNotMix",
  shouldPlayInBackground: false,
};

export async function configureForRecording() {
  await setAudioModeAsync(RECORD_MODE);
}
export async function configureForPlayback() {
  await setAudioModeAsync(PLAYBACK_MODE);
}

/**
 * Mount-once hook: sets the baseline (playback) audio mode so the app starts
 * in a known state. Practice screen flips to recording mode before each
 * recording and back to playback before TTS playback.
 */
export function useAudioSessionInit() {
  useEffect(() => {
    void configureForPlayback();
  }, []);
}
