import AsyncStorage from "@react-native-async-storage/async-storage";

// The conversation transport the user has selected. Push-to-talk is the default
// for everyone; live (always-listening) and speech-to-speech are gated server
// side (see GET /v1/voice/modes) and only offered to entitled accounts.
export type VoiceMode = "push_to_talk" | "live" | "speech_to_speech";

const STORAGE_KEY = "voice_mode";
const DEFAULT_MODE: VoiceMode = "push_to_talk";
const VALID_MODES: readonly VoiceMode[] = [
  "push_to_talk",
  "live",
  "speech_to_speech",
];

function isVoiceMode(value: string | null): value is VoiceMode {
  return value != null && (VALID_MODES as readonly string[]).includes(value);
}

export async function getVoiceMode(): Promise<VoiceMode> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return isVoiceMode(raw) ? raw : DEFAULT_MODE;
}

export async function setVoiceMode(mode: VoiceMode): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, mode);
}
