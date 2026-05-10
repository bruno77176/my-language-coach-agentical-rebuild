import { useEffect, useRef, useState } from "react";
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  createAudioPlayer,
} from "expo-audio";
import {
  buildGreeting,
  getCoachFallback,
  type SoftErrorCode,
  type SupportedLang,
} from "@language-coach/shared";
import {
  configureForPlayback,
  configureForRecording,
} from "@/src/lib/audio-session";
import { startSession, streamTurn, endSession } from "@/src/lib/api-client";
import type { ChatMessage, ConversationState } from "./types";
import { fetchGreetingAudio } from "./api-greeting";
import { AudioQueue } from "./audio-queue";

export type { ChatMessage, ConversationState } from "./types";

const SOFT_ERROR_CODES: ReadonlySet<SoftErrorCode> = new Set([
  "AUDIO_SILENT",
  "AUDIO_TOO_SHORT",
  "STT_PROVIDER_FAILURE",
  "LLM_PROVIDER_FAILURE",
  "TTS_PROVIDER_FAILURE",
]);

/**
 * Plays a single audio URL to completion. Resolves when finished or after a
 * timeout (estimated from text length). Auto-plays once `isLoaded` becomes
 * true; the imperative `createAudioPlayer().play()` doesn't reliably trigger
 * playback before the source is loaded for remote URLs.
 */
async function playOnce(input: {
  uri: string;
  text?: string;
  durationMs?: number;
}): Promise<void> {
  const player = createAudioPlayer({ uri: input.uri });
  await new Promise<void>((resolve) => {
    let resolved = false;
    let triggered = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      try {
        player.remove();
      } catch {
        // ignore
      }
      resolve();
    };

    const sub = player.addListener(
      "playbackStatusUpdate",
      (s: {
        isLoaded?: boolean;
        playing?: boolean;
        didJustFinish?: boolean;
      }) => {
        if (s.isLoaded && !triggered) {
          triggered = true;
          try {
            player.play();
          } catch {
            // ignore
          }
        }
        if (s.didJustFinish) {
          sub.remove();
          finish();
        }
      },
    );

    // Hard timeout fallback so the queue never hangs.
    const estimatedMs =
      input.durationMs && input.durationMs > 0
        ? input.durationMs
        : Math.max(2500, (input.text?.length ?? 0) * 80);
    setTimeout(() => {
      sub.remove();
      finish();
    }, estimatedMs + 6000);

    // Also try to start immediately — in case isLoaded fires before we set up
    // the listener (or never fires for cached/local sources).
    try {
      player.play();
    } catch {
      // ignore
    }
  });
}

export function useConversation(
  targetLang: string,
  displayName: string,
  nativeLang: string,
) {
  const [state, setState] = useState<ConversationState>({
    phase: "loading-session",
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [listeningMode, setListeningMode] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const conversationIdRef = useRef<string | null>(null);
  const recordingStartedAtRef = useRef<number | null>(null);
  const greetingPlayedRef = useRef(false);

  // Reset reveals when listening mode toggles
  useEffect(() => {
    setRevealedIds(new Set());
  }, [listeningMode]);

  // Session start: create conv + insert greeting + fetch + play greeting audio
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { conversation_id } = await startSession(targetLang);
        if (cancelled) return;
        conversationIdRef.current = conversation_id;

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

        // Fetch greeting audio in parallel; failure is non-fatal
        try {
          const { audioUrl } = await fetchGreetingAudio({
            lang: targetLang,
            name: displayName,
          });
          if (cancelled) return;
          setMessages((prev) =>
            prev.map((m) => (m.id === greetingMsg.id ? { ...m, audioUrl } : m)),
          );
          if (!greetingPlayedRef.current) {
            greetingPlayedRef.current = true;
            await configureForPlayback();
            void playOnce({ uri: audioUrl, text: greetingText });
          }
        } catch {
          // best-effort
        }
      } catch (err) {
        if (cancelled) return;
        setState({ phase: "error", message: (err as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetLang, displayName, nativeLang]);

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

      // Stream turn — handle the chunk-based protocol
      const { events } = streamTurn(conversationId, uri);
      const audioQueue = new AudioQueue({
        playChunk: async (chunk) => {
          await configureForPlayback();
          await playOnce({
            uri: chunk.audioUrl,
            text: chunk.text,
            durationMs: chunk.durationMs,
          });
        },
      });

      let coachMessageId: string | null = null;
      const chunkTexts: string[] = [];

      for await (const event of events) {
        if (event.type === "transcription") {
          setMessages((prev) => [
            ...prev,
            {
              id: `u-${Date.now()}`,
              role: "user",
              text: event.text,
              audioUrl: uri,
              audioDurationMs: durationMs,
            },
          ]);
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
        } else if (event.type === "error") {
          const code = event.code as SoftErrorCode;
          if (SOFT_ERROR_CODES.has(code)) {
            pushSoftErrorAsCoachMessage(code);
            await audioQueue.waitForDrain();
            setState({ phase: "idle", conversationId });
            return;
          }
          throw new Error(`${event.code}: ${event.message}`);
        }
      }

      await audioQueue.waitForDrain();
      setState({ phase: "idle", conversationId });
    } catch (err) {
      setState({ phase: "error", message: (err as Error).message });
    }
  }

  async function end() {
    const conversationId = conversationIdRef.current;
    if (!conversationId) return null;
    return endSession(conversationId);
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
          const { conversation_id } = await startSession(targetLang);
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
    start,
    stop,
    end,
    dismissError,
    toggleListeningMode,
    revealMessage,
  };
}
