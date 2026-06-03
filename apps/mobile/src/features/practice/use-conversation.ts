import { useCallback, useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
} from "expo-audio";
import {
  buildGreeting,
  getCoachFallback,
  type SoftErrorCode,
  type SupportedLang,
} from "@language-coach/shared";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { configureForRecording } from "@/src/lib/audio-session";
import {
  startSession,
  streamTurn,
  streamOpening,
  endSession,
  type TurnEvent,
} from "@/src/lib/api-client";
import type { ChatMessage, ConversationState } from "./types";
import { AudioQueue } from "./audio-queue";
import { fetchGreetingAudio } from "./api-greeting";
import { playOnce } from "./audio-controller";
import { useVoiceLab } from "@/src/features/voice-lab/voice-lab-store";

export const ACTIVE_SESSION_KEY = "active-session.v1";

export type PersistedActiveSession = {
  conversationId: string;
  lastActivityAt: number; // ms epoch
  eligible: boolean;
};

// Bundled greeting MP3s — emergency fallback if the personalized greeting
// (per-user, per-language, name spoken) can't be fetched / cached. Generic
// per language (no name); on-screen text still personalizes.
/* eslint-disable @typescript-eslint/no-require-imports */
const GREETING_AUDIO: Record<string, number> = {
  en: require("@/assets/sounds/greetings/en.mp3"),
  fr: require("@/assets/sounds/greetings/fr.mp3"),
  de: require("@/assets/sounds/greetings/de.mp3"),
  it: require("@/assets/sounds/greetings/it.mp3"),
  es: require("@/assets/sounds/greetings/es.mp3"),
  pt: require("@/assets/sounds/greetings/pt.mp3"),
  tr: require("@/assets/sounds/greetings/tr.mp3"),
  sv: require("@/assets/sounds/greetings/sv.mp3"),
  da: require("@/assets/sounds/greetings/da.mp3"),
  ru: require("@/assets/sounds/greetings/ru.mp3"),
  ro: require("@/assets/sounds/greetings/ro.mp3"),
  hu: require("@/assets/sounds/greetings/hu.mp3"),
};
/* eslint-enable @typescript-eslint/no-require-imports */

export type { ChatMessage, ConversationState } from "./types";

const SOFT_ERROR_CODES: ReadonlySet<SoftErrorCode> = new Set([
  "AUDIO_SILENT",
  "AUDIO_TOO_SHORT",
  "STT_PROVIDER_FAILURE",
  "LLM_PROVIDER_FAILURE",
  "TTS_PROVIDER_FAILURE",
]);

/**
 * Fetch the personalized greeting audio URL from backend (server-side
 * TTS cached per user+lang via signed Storage URL). Returns null on any
 * failure — caller should fall back to the bundled MP3.
 */
async function fetchPersonalizedGreetingUrl(
  lang: string,
  name: string,
): Promise<string | null> {
  try {
    const { audioUrl } = await fetchGreetingAudio({ lang, name });
    console.log("[GREETING] got personalized URL:", audioUrl.slice(0, 80));
    return audioUrl;
  } catch (err) {
    console.warn("[GREETING] personalized fetch failed:", err);
    return null;
  }
}

// playOnce lives in audio-controller.ts — it's the canonical "play one
// source through the global slot" function used by greeting, chunks, and
// per-message repeat. Centralizing it ensures every player is cleaned up
// (no leaks, no stale audio session).

export function useConversation(
  targetLang: string,
  displayName: string,
  nativeLang: string,
  scenarioId?: string,
) {
  const [state, setState] = useState<ConversationState>({
    phase: "loading-session",
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [listeningMode, setListeningMode] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [userTurnCount, setUserTurnCount] = useState(0);
  const [lastActivityAt, setLastActivityAt] = useState<number>(() =>
    Date.now(),
  );

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const conversationIdRef = useRef<string | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  // Guard against double-firing the paywall navigation if the SSE error
  // event arrives more than once or a follow-up turn also 429s. Reset on
  // successful turn (in the for-await success path below) so a user who
  // upgrades and starts a new day can be re-prompted next time.
  const paywallShownRef = useRef(false);

  // Reset reveals when listening mode toggles
  useEffect(() => {
    setRevealedIds(new Set());
  }, [listeningMode]);

  // Session start: create conv + insert greeting + fetch + play greeting audio
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { conversation_id } = await startSession(targetLang, scenarioId);
        if (cancelled) return;
        conversationIdRef.current = conversation_id;

        // Scenarios: the coach speaks first, in character. Play the opener
        // through the same reply-chunk/audio pipeline as a normal turn.
        if (scenarioId) {
          setMessages([]);
          await runOpening(conversation_id, () => cancelled);
          return;
        }

        const greetingText = buildGreeting(
          targetLang as SupportedLang,
          displayName,
        );
        // Pre-compute the native-lang translation so 🌐 toggles instantly
        // without an API call. (Greeting isn't a DB row so /translate would 404.)
        const greetingTranslation =
          nativeLang !== targetLang
            ? buildGreeting(nativeLang as SupportedLang, displayName)
            : undefined;
        const greetingMsg: ChatMessage = {
          id: `greeting-${Date.now()}`,
          role: "coach",
          text: greetingText,
          isGreeting: true,
          clientTranslation: greetingTranslation,
        };
        setMessages([greetingMsg]);
        setState({ phase: "idle", conversationId: conversation_id });

        // Play greeting: try personalized (server TTS, with name) first,
        // fall back to bundled generic MP3 only if backend fetch fails.
        const personalizedUrl = await fetchPersonalizedGreetingUrl(
          targetLang,
          displayName,
        );
        if (cancelled) return;
        if (personalizedUrl) {
          console.log("[GREETING] playing personalized");
          // Set audioUrl on the greeting so 🔁 can replay it.
          setMessages((prev) =>
            prev.map((m) =>
              m.id === greetingMsg.id ? { ...m, audioUrl: personalizedUrl } : m,
            ),
          );
          void playOnce({
            source: { uri: personalizedUrl },
            text: greetingText,
          });
        } else {
          console.log("[GREETING] falling back to bundled (no name)");
          const audioModule = GREETING_AUDIO[targetLang] ?? GREETING_AUDIO.en;
          if (audioModule !== undefined) {
            void playOnce({ source: audioModule, text: greetingText });
          }
        }
      } catch (err) {
        if (cancelled) return;
        setState({ phase: "error", message: (err as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetLang, displayName, nativeLang, scenarioId]);

  // Called by the Practice screen after each turn and on the session-timer
  // 30s threshold so the persisted "eligible" flag reflects the current
  // seconds spoken. The screen knows secondsSpoken; the hook knows turn count.
  const persistActive = useCallback(
    async (secondsSpoken: number) => {
      const id = conversationIdRef.current;
      if (!id) return;
      const eligible = userTurnCount >= 1 && secondsSpoken >= 30;
      const payload: PersistedActiveSession = {
        conversationId: id,
        lastActivityAt: Date.now(),
        eligible,
      };
      try {
        await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(payload));
      } catch {
        // best-effort — persistence failure should not break the conversation
      }
    },
    [userTurnCount],
  );

  // Single place that turns a coach SSE stream's reply-chunks into the growing
  // coach message + queued audio, and resolves the server message id on done.
  // Shared by user turns (stop) and the scenario opener (runOpening).
  function createAudioQueue() {
    return new AudioQueue({
      playChunk: async (chunk) => {
        await playOnce({
          source: { uri: chunk.audioUrl },
          text: chunk.text,
          durationMs: chunk.durationMs,
        });
      },
    });
  }

  type CoachStreamOutcome =
    | { kind: "ok" }
    | { kind: "paywall" }
    | { kind: "soft-error"; code: SoftErrorCode }
    | { kind: "fatal-error"; code: string; message: string };

  async function consumeCoachStream(
    events: AsyncIterable<TurnEvent>,
    audioQueue: ReturnType<typeof createAudioQueue>,
    onTranscription?: (text: string) => void,
  ): Promise<CoachStreamOutcome> {
    let coachMessageId: string | null = null;
    const chunkTexts: string[] = [];

    for await (const event of events) {
      if (event.type === "transcription") {
        onTranscription?.(event.text);
      } else if (event.type === "reply-chunk") {
        chunkTexts[event.index] = event.text;
        const accumText = chunkTexts.filter(Boolean).join(" ");
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (
            last &&
            last.role === "coach" &&
            coachMessageId !== null &&
            last.id === coachMessageId
          ) {
            return [
              ...prev.slice(0, -1),
              { ...last, text: accumText, audioUrl: event.audioUrl },
            ];
          }
          const newId = `c-${Date.now()}`;
          coachMessageId = newId;
          return [
            ...prev,
            {
              id: newId,
              role: "coach",
              text: accumText,
              audioUrl: event.audioUrl,
            },
          ];
        });
        audioQueue.enqueue({
          index: event.index,
          text: event.text,
          audioUrl: event.audioUrl,
          durationMs: event.durationMs,
        });
      } else if (event.type === "done") {
        if (coachMessageId && event.messageId) {
          const serverId = event.messageId;
          const localId = coachMessageId;
          setMessages((prev) =>
            prev.map((m) => (m.id === localId ? { ...m, id: serverId } : m)),
          );
        }
        setLastActivityAt(Date.now());
      } else if (event.type === "error") {
        if (event.code === "DAILY_QUOTA_EXCEEDED") {
          return { kind: "paywall" };
        }
        const code = event.code as SoftErrorCode;
        if (SOFT_ERROR_CODES.has(code)) {
          pushSoftErrorAsCoachMessage(code);
          return { kind: "soft-error", code };
        }
        return {
          kind: "fatal-error",
          code: event.code,
          message: event.message,
        };
      }
    }
    return { kind: "ok" };
  }

  // Scenario opener: the coach speaks first. Non-fatal — whatever happens we
  // land on idle so the user can start talking. Free turn (no quota).
  async function runOpening(
    conversationId: string,
    isCancelled: () => boolean,
  ) {
    setState({ phase: "processing", conversationId });
    const audioQueue = createAudioQueue();
    try {
      const { events } = streamOpening(conversationId);
      const outcome = await consumeCoachStream(events, audioQueue);
      await audioQueue.waitForDrain();
      // Opener is soft-fail (we still land on idle), but surface a coach-side
      // error so a broken /opening endpoint isn't invisible in the field.
      if (outcome.kind === "fatal-error" || outcome.kind === "soft-error") {
        console.warn(`[OPENING] coach stream error: ${outcome.code}`);
      }
    } catch (err) {
      console.warn("[OPENING] failed:", err);
    }
    if (isCancelled()) return;
    setState({ phase: "idle", conversationId });
  }

  async function start() {
    if (state.phase !== "idle") return;
    const conversationId = state.conversationId;
    try {
      let perm = await getRecordingPermissionsAsync();
      if (!perm.granted) perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        throw new Error(
          "Microphone permission denied. Enable it in Settings → Apps → My Language Coach → Permissions.",
        );
      }
      await configureForRecording();
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingStartedAtRef.current = Date.now();
      setState({ phase: "recording", conversationId });
    } catch (err) {
      setState({ phase: "error", message: (err as Error).message });
    }
  }

  function pushSoftErrorAsCoachMessage(code: SoftErrorCode) {
    const text = getCoachFallback(targetLang as SupportedLang, code);
    setMessages((prev) => [
      ...prev,
      {
        id: `soft-${code}-${Date.now()}`,
        role: "coach",
        text,
      },
    ]);
  }

  async function stop() {
    if (state.phase !== "recording") return;
    const conversationId = state.conversationId;
    setState({ phase: "processing", conversationId });

    // Compute duration from our own timestamp BEFORE recorder.stop() resets state.
    const startedAt = recordingStartedAtRef.current ?? Date.now();
    const durationMs = Date.now() - startedAt;
    recordingStartedAtRef.current = null;

    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("Recorder produced no audio file");

      // No client-side silence detection — server's AUDIO_SILENT check is the
      // source of truth. Client heuristic was unreliable (recorder.getStatus()
      // returns 0 after stop()).

      // Stream turn — handle the chunk-based protocol. Read the dev Voice Lab
      // override imperatively (not as a reactive hook) so it never lands in a
      // dependency array; when disabled, undefined => backend defaults.
      const vl = useVoiceLab.getState();
      const voiceOverride = vl.overrideEnabled ? vl.config : undefined;
      const { events } = streamTurn(conversationId, uri, voiceOverride);
      const audioQueue = createAudioQueue();

      const outcome = await consumeCoachStream(events, audioQueue, (text) => {
        setMessages((prev) => [
          ...prev,
          {
            id: `u-${Date.now()}`,
            role: "user",
            text,
            audioUrl: uri,
            audioDurationMs: durationMs,
          },
        ]);
        setUserTurnCount((n) => n + 1);
        setLastActivityAt(Date.now());
      });

      if (outcome.kind === "paywall") {
        await audioQueue.waitForDrain();
        if (!paywallShownRef.current) {
          paywallShownRef.current = true;
          router.push("/(modals)/paywall");
        }
        setState({ phase: "idle", conversationId });
        return;
      }
      if (outcome.kind === "soft-error") {
        await audioQueue.waitForDrain();
        setState({ phase: "idle", conversationId });
        return;
      }
      if (outcome.kind === "fatal-error") {
        throw new Error(`${outcome.code}: ${outcome.message}`);
      }

      await audioQueue.waitForDrain();
      paywallShownRef.current = false;
      setState({ phase: "idle", conversationId });
    } catch (err) {
      setState({ phase: "error", message: (err as Error).message });
    }
  }

  async function end(): Promise<{
    conversationId: string | null;
    secondsSpoken: number;
  }> {
    const conversationId = conversationIdRef.current;
    if (!conversationId) {
      await AsyncStorage.removeItem(ACTIVE_SESSION_KEY).catch(() => {});
      return { conversationId: null, secondsSpoken: 0 };
    }
    const result = await endSession(conversationId);
    await AsyncStorage.removeItem(ACTIVE_SESSION_KEY).catch(() => {});
    return {
      conversationId,
      secondsSpoken: result.seconds_spoken ?? 0,
    };
  }

  function dismissError() {
    if (state.phase !== "error") return;
    const conversationId = conversationIdRef.current;
    if (conversationId) {
      setState({ phase: "idle", conversationId });
    } else {
      setState({ phase: "loading-session" });
      void (async () => {
        try {
          const { conversation_id } = await startSession(
            targetLang,
            scenarioId,
          );
          conversationIdRef.current = conversation_id;
          setState({ phase: "idle", conversationId: conversation_id });
        } catch (err) {
          setState({ phase: "error", message: (err as Error).message });
        }
      })();
    }
  }

  function toggleListeningMode() {
    setListeningMode((m) => !m);
  }

  function revealMessage(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  return {
    state,
    messages,
    listeningMode,
    revealedIds,
    userTurnCount,
    lastActivityAt,
    persistActive,
    start,
    stop,
    end,
    dismissError,
    toggleListeningMode,
    revealMessage,
  };
}
