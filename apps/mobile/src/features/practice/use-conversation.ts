import { useEffect, useRef, useState } from "react";
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  createAudioPlayer,
} from "expo-audio";
import { File } from "expo-file-system";
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
import { isLikelySilent } from "./audio-rms";

export type { ChatMessage, ConversationState } from "./types";

const SOFT_ERROR_CODES: ReadonlySet<SoftErrorCode> = new Set([
  "AUDIO_SILENT",
  "AUDIO_TOO_SHORT",
  "STT_PROVIDER_FAILURE",
  "LLM_PROVIDER_FAILURE",
  "TTS_PROVIDER_FAILURE",
]);

export function useConversation(targetLang: string, displayName: string) {
  const [state, setState] = useState<ConversationState>({
    phase: "loading-session",
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [listeningMode, setListeningMode] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const conversationIdRef = useRef<string | null>(null);

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
        const greetingMsg: ChatMessage = {
          id: `greeting-${Date.now()}`,
          role: "coach",
          text: greetingText,
          isGreeting: true,
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
          await configureForPlayback();
          const player = createAudioPlayer({ uri: audioUrl });
          player.play();
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
  }, [targetLang, displayName]);

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

    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("Recorder produced no audio file");

      // Client-side silence detection (heuristic on file size + duration)
      // recorder.getStatus() is synchronous and returns RecorderState
      const status = recorder.getStatus();
      const durationMs: number | undefined = status.durationMillis;
      // expo-file-system v19: use new File API (getInfoAsync throws at runtime)
      const fileSizeBytes = new File(uri).size;

      if (isLikelySilent({ durationMs, fileSizeBytes })) {
        pushSoftErrorAsCoachMessage("AUDIO_SILENT");
        setState({ phase: "idle", conversationId });
        return;
      }

      // Stream turn — handle the chunk-based protocol
      const { events } = streamTurn(conversationId, uri);
      const audioQueue = new AudioQueue({
        playChunk: async (chunk) => {
          await configureForPlayback();
          const player = createAudioPlayer({ uri: chunk.audioUrl });
          await new Promise<void>((resolve) => {
            const sub = player.addListener(
              "playbackStatusUpdate",
              (s: { didJustFinish?: boolean }) => {
                if (s.didJustFinish) {
                  sub.remove();
                  player.remove();
                  resolve();
                }
              },
            );
            player.play();
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
