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
  // Half-duplex turn-taking: playing the coach's reply kills the iOS mic tap
  // (expo-audio's player interrupts expo-stream-audio's engine), so after each
  // coach turn we restart capture for the user's next turn. pendingWrites tracks
  // in-flight chunk file writes so we only revive once the reply has truly
  // finished playing; runningRef guards against reviving after the user leaves.
  const pendingWritesRef = useRef(0);
  const runningRef = useRef(false);
  const revivingRef = useRef(false);
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
          // Keep the playAndRecord session — switching to playback-only would
          // kill the always-on mic, so the user couldn't be heard after the
          // coach's first reply (Deepgram then idle-closes with 1011).
          keepSession: true,
        });
      },
    });
    queueRef.current = queue;

    // After the coach's reply has finished playing, restart mic capture so the
    // user can speak again (the playback interrupted the iOS input tap). Waits
    // for the queue to drain AND all chunk writes to settle so we don't revive
    // mid-reply (which would let a late chunk kill the freshly-revived mic).
    const reviveMicAfterCoach = async () => {
      if (revivingRef.current) return;
      revivingRef.current = true;
      try {
        for (let i = 0; i < 200; i++) {
          await queue.waitForDrain();
          if (pendingWritesRef.current === 0 && !queue.isPlaying()) break;
          await new Promise((r) => setTimeout(r, 50));
        }
        if (!runningRef.current) return; // user left while the coach was talking
        try {
          await StreamAudio.stop();
        } catch {
          // already stopped
        }
        if (!runningRef.current) return;
        await configureForRecording();
        await StreamAudio.start({
          sampleRate: 16000,
          channels: 1,
          enableLevelMeter: true,
        });
      } catch (e) {
        setDebug((d) => ({ ...d, err: `revive: ${(e as Error).message}` }));
      } finally {
        revivingRef.current = false;
      }
    };

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
          pendingWritesRef.current++;
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
            })
            .finally(() => {
              pendingWritesRef.current--;
            });
        },
        onTurnDone: () => {
          dispatch({ type: "TURN_DONE" });
          void reviveMicAfterCoach();
        },
        onError: (code) => dispatch({ type: "ERROR", code }),
        onClose: () => dispatch({ type: "CLOSED" }),
      },
    });
    socketRef.current = socket;

    dispatch({ type: "START" });
    mutedRef.current = false;
    framesSentRef.current = 0;
    runningRef.current = true;
    pendingWritesRef.current = 0;
    revivingRef.current = false;
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
    // Stop any in-flight mic revival from restarting capture after we tear down.
    runningRef.current = false;
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
