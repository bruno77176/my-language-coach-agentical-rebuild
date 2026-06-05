// Pure state machine for a Live voice session. No native/socket imports so it
// unit-tests in isolation; the useLiveConversation hook drives it from
// live-socket + expo-stream-audio events and renders from its state.
// (Client-VAD "userSpeaking" + barge-in transitions arrive in Plan C.)

export type LivePhase = "idle" | "listening" | "thinking" | "coachSpeaking";

export type LiveState = {
  phase: LivePhase;
  muted: boolean;
  userTranscript: string;
  coachText: string;
  error: string | null;
};

export const initialLiveState: LiveState = {
  phase: "idle",
  muted: false,
  userTranscript: "",
  coachText: "",
  error: null,
};

export type LiveEvent =
  | { type: "START" }
  | { type: "STOP" }
  | { type: "TOGGLE_MUTE" }
  | { type: "USER_TRANSCRIPT"; text: string }
  | { type: "REPLY_CHUNK"; text: string }
  | { type: "TURN_DONE" }
  | { type: "ERROR"; code: string }
  | { type: "CLOSED" };

export function liveReducer(state: LiveState, event: LiveEvent): LiveState {
  switch (event.type) {
    case "START":
      return { ...initialLiveState, phase: "listening" };
    case "STOP":
    case "CLOSED":
      return { ...initialLiveState };
    case "TOGGLE_MUTE":
      return { ...state, muted: !state.muted };
    case "USER_TRANSCRIPT":
      return {
        ...state,
        phase: "thinking",
        userTranscript: event.text,
        coachText: "",
      };
    case "REPLY_CHUNK":
      return {
        ...state,
        phase: "coachSpeaking",
        coachText: state.coachText
          ? `${state.coachText} ${event.text}`
          : event.text,
      };
    case "TURN_DONE":
      return { ...state, phase: "listening" };
    case "ERROR":
      return { ...state, error: event.code };
    default:
      return state;
  }
}
