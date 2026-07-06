import { Hono } from "hono";
import type { UpgradeWebSocket } from "hono/ws";
import {
  openLiveTranscription,
  type ConnectFn,
  type LiveSocket,
} from "../providers/deepgram-live";
import { runTurn, type RunTurnDeps } from "./run-turn";
import { deepgramModelForLanguage } from "../providers/deepgram";
import { canUseLiveVoice } from "../lib/voice-entitlement";
import type { Verifier } from "../middleware/auth";
import type { ChatMessage } from "../providers/openai";

// Everything the route needs to run Live turns for a connection: the target
// language and the seed message list (system prompt + pre-session history).
// The connection appends each user utterance and coach reply to its own running
// copy, so the coach remembers earlier exchanges within the live session.
export type LiveTurnContext = {
  languageCode: string;
  baseMessages: ChatMessage[];
};

export type LiveConnectionDeps = {
  connectDeepgram: ConnectFn;
  runTurnDeps: RunTurnDeps;
};

type WsLike = {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
};

// The transport-agnostic core of a Live connection: bridges inbound audio to
// Deepgram, runs a turn on each end-of-utterance, streams reply-chunks back,
// and cancels the in-flight turn on a barge-in. Pure enough to unit-test
// without the WebSocket framework.
export function createLiveConnection(
  deps: LiveConnectionDeps,
  params: { ctx: LiveTurnContext },
) {
  let live: LiveSocket | null = null;
  let transcriptParts: string[] = [];
  let currentTurn: AbortController | null = null;
  let ws: WsLike | null = null;
  let frameCount = 0;
  // Forward mic audio only while Deepgram's socket readyState is OPEN. We check
  // readyState live (live.isOpen()) rather than trusting the one-shot "open"
  // event — the SDK fires that into a single handler that can be registered
  // after the event already fired, which would deadlock us into dropping every
  // frame (Deepgram then idle-closes with code 1000). Counters are for logging.
  let droppedBeforeOpen = 0;
  let forwarded = 0;
  // KeepAlive: hold the Deepgram socket open while no audio is flowing (the
  // coach's turn in half-duplex). Without this it idle-closes (1011) ~10s after
  // the mic pauses, breaking the next turn.
  let lastAudioAt = Date.now();
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  // Running conversation for this live session — appended each turn so the
  // coach remembers what was said earlier in the session.
  const convo: ChatMessage[] = [...params.ctx.baseMessages];

  const send = (msg: unknown) => ws?.send(JSON.stringify(msg));

  const runOneTurn = async (utterance: string) => {
    const turn = new AbortController();
    currentTurn = turn;
    convo.push({ role: "user", content: utterance });
    send({ type: "user-transcript", text: utterance });
    const { fullText } = await runTurn(
      deps.runTurnDeps,
      {
        messages: [...convo],
        languageCode: params.ctx.languageCode,
        // Live mode is allowlist-gated (a premium beta) → premium voice tier.
        isPro: true,
        signal: turn.signal,
      },
      ({ index, text, audio }) => {
        if (turn.signal.aborted) return; // barge-in: don't deliver stale audio
        send({
          type: "reply-chunk",
          index,
          text,
          audioBase64: audio.audioBuffer.toString("base64"),
          contentType: audio.contentType,
        });
      },
      (index) => {
        send({ type: "error", code: "TTS_PROVIDER_FAILURE", index });
      },
    );
    if (!turn.signal.aborted) {
      convo.push({ role: "assistant", content: fullText });
      send({ type: "turn-done" });
    }
  };

  return {
    onOpen: async (socket: WsLike) => {
      ws = socket;
      console.warn(
        `[live] ws open; connecting Deepgram (lang=${params.ctx.languageCode} model=${deepgramModelForLanguage(params.ctx.languageCode)})`,
      );
      try {
        live = await openLiveTranscription(
          { connect: deps.connectDeepgram },
          { languageCode: params.ctx.languageCode },
        );
      } catch (err) {
        console.warn(
          `[live] Deepgram connect failed: ${(err as Error).message}`,
        );
        send({ type: "error", code: "STT_CONNECT_FAILED" });
        return;
      }
      live.on("open", () => {
        console.warn("[live] Deepgram socket open");
      });
      live.on("close", (p) => {
        const ce = p as { code?: number; reason?: string } | undefined;
        console.warn(
          `[live] Deepgram socket closed (code=${ce?.code ?? "?"} reason="${ce?.reason ?? ""}" forwarded=${forwarded} droppedBeforeOpen=${droppedBeforeOpen})`,
        );
        // Tell the client so the UI doesn't sit in "Listening…" forever when
        // Deepgram refuses or drops the connection.
        send({ type: "error", code: `STT_CLOSED:${ce?.code ?? "?"}` });
      });
      live.on("transcript", (p) => {
        const text = (p as { text: string }).text;
        console.warn(`[live] transcript: ${text}`);
        if (text) transcriptParts.push(text);
      });
      live.on("utteranceEnd", () => {
        const utterance = transcriptParts.join(" ").trim();
        transcriptParts = [];
        console.warn(`[live] utteranceEnd -> turn (utterance="${utterance}")`);
        if (utterance) void runOneTurn(utterance);
      });
      live.on("error", (p) => {
        const ee = p as
          | { message?: string; error?: unknown; type?: string }
          | undefined;
        const detail =
          ee?.message ?? ee?.type ?? JSON.stringify(p) ?? "unknown";
        console.warn(`[live] Deepgram error: ${detail}`);
        send({ type: "error", code: "STT_PROVIDER_FAILURE" });
      });
      // Hold the socket open during silence (coach's turn). Deepgram resets its
      // idle timer on any audio, so only send KeepAlive when no audio has been
      // forwarded recently.
      keepAliveTimer = setInterval(() => {
        if (live?.isOpen() && Date.now() - lastAudioAt > 4000) {
          live.keepAlive();
        }
      }, 4000);
      // Don't let the interval keep the process/test event loop alive.
      (keepAliveTimer as { unref?: () => void }).unref?.();
    },
    onMessage: (data: unknown, socket: WsLike) => {
      ws = socket;
      if (typeof data === "string") {
        try {
          const msg = JSON.parse(data) as { type?: string; msg?: string };
          if (msg?.type === "cancel") currentTurn?.abort();
          // Client-side diagnostics (mic start status / errors) surfaced here so
          // device-only failures are visible in the server logs.
          else if (msg?.type === "client-log")
            console.warn(`[live] client: ${msg.msg}`);
        } catch {
          // ignore non-JSON text frames
        }
        return;
      }
      // Binary audio frame → Deepgram
      if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
        frameCount++;
        if (frameCount === 1) console.warn("[live] first audio frame received");
        if (frameCount % 100 === 0)
          console.warn(`[live] ${frameCount} audio frames received`);
        // Forward only while the socket readyState is OPEN. Checking it live
        // (not a captured "open" event) avoids the deadlock where a missed open
        // event leaves us dropping every frame until Deepgram idle-closes.
        if (live?.isOpen()) {
          if (forwarded === 0)
            console.warn("[live] forwarding audio to Deepgram");
          forwarded++;
          lastAudioAt = Date.now();
          live.sendAudio(data as ArrayBuffer | ArrayBufferView);
        } else {
          droppedBeforeOpen++;
        }
      } else {
        console.warn(
          `[live] unhandled binary frame type: ${Object.prototype.toString.call(data)}`,
        );
      }
    },
    onClose: () => {
      if (keepAliveTimer) clearInterval(keepAliveTimer);
      keepAliveTimer = null;
      currentTurn?.abort();
      live?.close();
    },
  };
}

export type VoiceLiveRouteDeps = LiveConnectionDeps & {
  verifier: Verifier;
  liveUserIds: string[];
  // Ownership-checked loader; returns null when the conversation doesn't exist
  // or isn't the caller's (→ the socket is closed).
  loadContext: (
    userId: string,
    conversationId: string,
  ) => Promise<LiveTurnContext | null>;
  upgradeWebSocket: UpgradeWebSocket;
};

// GET /v1/voice/live (WebSocket). Auth is by `?token=` (RN can't set WS
// headers; wss is TLS so it's encrypted in transit — never log the URL).
// Gated to allowlisted users; everyone else is closed with 4403.
export function createVoiceLiveRoute(deps: VoiceLiveRouteDeps) {
  const routes = new Hono();
  routes.get(
    "/voice/live",
    deps.upgradeWebSocket(async (c) => {
      const token = c.req.query("token") ?? "";
      const conversationId = c.req.query("conversation_id") ?? "";
      let userId: string;
      try {
        ({ userId } = await deps.verifier(token));
      } catch {
        return { onOpen: (_e, ws) => ws.close(4401, "unauthorized") };
      }
      if (!canUseLiveVoice(userId, deps.liveUserIds)) {
        return { onOpen: (_e, ws) => ws.close(4403, "forbidden") };
      }
      const ctx = await deps.loadContext(userId, conversationId);
      if (!ctx) {
        return { onOpen: (_e, ws) => ws.close(4404, "no conversation") };
      }
      const conn = createLiveConnection(deps, { ctx });
      return {
        onOpen: (_e, ws) => void conn.onOpen(ws),
        onMessage: (evt, ws) => conn.onMessage(evt.data, ws),
        onClose: () => conn.onClose(),
      };
    }),
  );
  return routes;
}
