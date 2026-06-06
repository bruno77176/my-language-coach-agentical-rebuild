import { useCallback, useReducer, useRef, useState } from "react";
import * as StreamAudio from "expo-stream-audio";
import {
  cacheDirectory,
  writeAsStringAsync,
  EncodingType,
} from "expo-file-system/legacy";
import { supabase } from "@/src/lib/supabase";
import {
  configureForRecording,
  configureForPlayback,
} from "@/src/lib/audio-session";
import { startSession } from "@/src/lib/api-client";
import { AudioQueue } from "./audio-queue";
import { playOnce } from "./audio-controller";
import { createLiveSocket } from "@/src/lib/live-socket";
import { liveReducer, initialLiveState } from "./live-machine";

// Live (always-listening) conversation: streams mic PCM frames from
// expo-stream-audio to /v1/voice/live and plays the coach reply-chunks back
// through the shared AudioQueue. Pure state lives in liveReducer (unit-tested);
// this hook is the device-side wiring (mic + socket + playback) and is
// validated on-device. Barge-in/mute-VAD polish lands in Plan C.
export function useLiveConversation(targetLang: string, scenarioId?: string) {
  const [state, dispatch] = useReducer(liveReducer, initialLiveState);
  const socketRef = useRef<ReturnType<typeof createLiveSocket> | null>(null);
  const queueRef = useRef<AudioQueue | null>(null);
  const frameSubRef = useRef<{ remove: () => void } | null>(null);
  // Native error events (mic-permission / audio-session / audio-engine
  // failures) — the module emits these on "onError" independent of whether
  // start() also rejects. Wiring it is how a silent device failure becomes
  // visible. See live-socket sendLog for the server-side copy.
  const errorSubRef = useRef<{ remove: () => void } | null>(null);
  // Read inside the frame listener (avoids a stale closure on state.muted).
  const mutedRef = useRef(false);
  // On-screen mic diagnostics (frames sent + last level/error) so a "nothing
  // happens" report is conclusive: frames>0 ⇒ capture+send work.
  const framesSentRef = useRef(0);
  const [debug, setDebug] = useState<{
    frames: number;
    level: number;
    err: string | null;
  }>({ frames: 0, level: 0, err: null });

  const start = useCallback(async () => {
    const perm = await StreamAudio.requestPermission();
    if (perm === "denied") {
      dispatch({ type: "ERROR", code: "MIC_DENIED" });
      return;
    }

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      dispatch({ type: "ERROR", code: "NO_SESSION" });
      return;
    }

    let conversationId: string;
    try {
      const session = await startSession(targetLang, scenarioId);
      conversationId = session.conversation_id;
    } catch {
      dispatch({ type: "ERROR", code: "SESSION_FAIL" });
      return;
    }

    const queue = new AudioQueue({
      playChunk: async (chunk) => {
        await playOnce({
          source: { uri: chunk.audioUrl },
          text: chunk.text,
          durationMs: chunk.durationMs,
        });
      },
    });
    queueRef.current = queue;

    const socket = createLiveSocket({
      token,
      conversationId,
      callbacks: {
        onUserTranscript: (text) => dispatch({ type: "USER_TRANSCRIPT", text }),
        onReplyChunk: (chunk) => {
          dispatch({ type: "REPLY_CHUNK", text: chunk.text });
          // Write the inline base64 audio to a cache file and queue it for
          // ordered playback (same pattern as the push-to-talk loop).
          const ext = chunk.contentType === "audio/wav" ? "wav" : "mp3";
          const uri =
            (cacheDirectory ?? "") +
            `live-chunk-${Date.now()}-${chunk.index}.${ext}`;
          writeAsStringAsync(uri, chunk.audioBase64, {
            encoding: EncodingType.Base64,
          })
            .then(() => {
              queue.enqueue({
                index: chunk.index,
                text: chunk.text,
                audioUrl: uri,
                durationMs: 0,
              });
            })
            .catch(() => {
              // Write failed — keep the transcript, skip this chunk's audio.
            });
        },
        onTurnDone: () => dispatch({ type: "TURN_DONE" }),
        onError: (code) => dispatch({ type: "ERROR", code }),
        onClose: () => dispatch({ type: "CLOSED" }),
      },
    });
    socketRef.current = socket;

    dispatch({ type: "START" });
    mutedRef.current = false;
    framesSentRef.current = 0;
    setDebug({ frames: 0, level: 0, err: null });

    // Surface native mic failures (permission / session / engine) on-screen and
    // in the server log. Without this the module's onError is dropped and a
    // device-only failure looks like "0 frames, no error".
    errorSubRef.current = StreamAudio.addErrorListener((e) => {
      const msg = `native: ${e.message}`;
      setDebug((d) => ({ ...d, err: msg }));
      socket.sendLog(msg);
    });

    frameSubRef.current = StreamAudio.addFrameListener((frame) => {
      if (mutedRef.current) return;
      try {
        socket.sendAudio(frame.pcmBase64);
        framesSentRef.current++;
        // Repaint on the very first frame (not just every 25th) so a single
        // frame is enough to prove capture+send work — the previous readout
        // sat at 0 for the first 24 frames, blurring "never fired" with "fired".
        if (framesSentRef.current === 1 || framesSentRef.current % 25 === 0) {
          setDebug({
            frames: framesSentRef.current,
            level: frame.level ?? 0,
            err: null,
          });
        }
      } catch (e) {
        setDebug((d) => ({
          ...d,
          frames: framesSentRef.current,
          err: `send: ${(e as Error).message}`,
        }));
      }
    });

    // iOS needs the audio session in record (playAndRecord) mode or the mic
    // captures nothing — push-to-talk does this before every recording. Live
    // stays in record mode for the whole session (continuous mic + playback).
    // The native module ALSO sets the AVAudioSession category on start(); a
    // throw here (session/engine failure) was previously swallowed, so capture
    // its message into the on-screen readout + server log to pin the layer.
    try {
      await configureForRecording();
      await StreamAudio.start({
        sampleRate: 16000,
        channels: 1,
        enableLevelMeter: true,
      });
      const status = await StreamAudio.getStatus();
      socket.sendLog(`start ok status=${status} perm=${perm}`);
      setDebug((d) => ({
        ...d,
        err: status === "recording" ? d.err : "not-recording",
      }));
    } catch (e) {
      const msg = `start: ${(e as Error).message}`;
      setDebug((d) => ({ ...d, err: msg }));
      socket.sendLog(msg);
      dispatch({ type: "ERROR", code: msg });
    }
  }, [targetLang, scenarioId]);

  const stop = useCallback(async () => {
    frameSubRef.current?.remove();
    frameSubRef.current = null;
    errorSubRef.current?.remove();
    errorSubRef.current = null;
    try {
      await StreamAudio.stop();
    } catch {
      // already stopped
    }
    socketRef.current?.close();
    socketRef.current = null;
    queueRef.current?.reset();
    queueRef.current = null;
    void configureForPlayback();
    dispatch({ type: "STOP" });
  }, []);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    dispatch({ type: "TOGGLE_MUTE" });
  }, []);

  return { state, debug, start, stop, toggleMute };
}
