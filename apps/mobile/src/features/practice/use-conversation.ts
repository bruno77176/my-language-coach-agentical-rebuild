import { useEffect, useRef, useState } from "react";
import {
  useAudioRecorder,
  useAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
} from "expo-audio";
import {
  configureForPlayback,
  configureForRecording,
} from "@/src/lib/audio-session";
import { startSession, streamTurn, endSession } from "@/src/lib/api-client";
import type { ChatMessage, ConversationState } from "./types";

export type { ChatMessage, ConversationState } from "./types";

export function useConversation(targetLang: string) {
  const [state, setState] = useState<ConversationState>({
    phase: "loading-session",
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  // useAudioPlayer accepts a source or null; we pass the latest audioUrl
  // when available so the player loads it ready for playback.
  const [coachAudioUrl, setCoachAudioUrl] = useState<string | null>(null);
  const player = useAudioPlayer(coachAudioUrl);

  const conversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { conversation_id } = await startSession(targetLang);
        if (cancelled) return;
        conversationIdRef.current = conversation_id;
        setState({ phase: "idle", conversationId: conversation_id });
      } catch (err) {
        if (cancelled) return;
        setState({ phase: "error", message: (err as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetLang]);

  // Auto-play whenever a new coach audio URL is set.
  useEffect(() => {
    if (!coachAudioUrl) return;
    void (async () => {
      try {
        await configureForPlayback();
        player.play();
      } catch (err) {
        // Swallow — audio playback is best-effort
        console.warn("[PRACTICE] play failed", err);
      }
    })();
  }, [coachAudioUrl, player]);

  async function start() {
    if (state.phase !== "idle") return;
    const conversationId = state.conversationId;
    try {
      // Android 6+ requires runtime permission. Check first; if not granted,
      // prompt. If user denies, surface a clear error.
      let perm = await getRecordingPermissionsAsync();
      if (!perm.granted) {
        perm = await requestRecordingPermissionsAsync();
      }
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

  async function stop() {
    if (state.phase !== "recording") return;
    const conversationId = state.conversationId;
    setState({ phase: "processing", conversationId });
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("Recorder produced no audio file");

      const { events } = streamTurn(conversationId, uri);
      let coachMessageId: string | null = null;
      for await (const event of events) {
        if (event.type === "transcription") {
          setMessages((prev) => [
            ...prev,
            {
              id: `u-${Date.now()}`,
              role: "user",
              text: event.text,
            },
          ]);
        } else if (event.type === "reply-text-delta") {
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
                { ...last, text: last.text + event.delta },
              ];
            }
            const newId = `c-${Date.now()}`;
            coachMessageId = newId;
            return [...prev, { id: newId, role: "coach", text: event.delta }];
          });
        } else if (event.type === "reply-audio") {
          setMessages((prev) => {
            if (!coachMessageId) return prev;
            return prev.map((m) =>
              m.id === coachMessageId ? { ...m, audioUrl: event.audioUrl } : m,
            );
          });
          setCoachAudioUrl(event.audioUrl);
        } else if (event.type === "done") {
          // Replace the client-generated coach id with the server's UUID so
          // translation calls (POST /v1/messages/:id/translate) hit a real row.
          if (coachMessageId && event.messageId) {
            const serverId = event.messageId;
            const localId = coachMessageId;
            setMessages((prev) =>
              prev.map((m) => (m.id === localId ? { ...m, id: serverId } : m)),
            );
          }
        } else if (event.type === "error") {
          throw new Error(`${event.code}: ${event.message}`);
        }
      }

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
      // No session yet — kick off a fresh one.
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

  return { state, messages, start, stop, end, dismissError };
}
