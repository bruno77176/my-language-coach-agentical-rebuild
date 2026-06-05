import { Hono } from "hono";
import type { UpgradeWebSocket } from "hono/ws";
import {
  openLiveTranscription,
  type ConnectFn,
  type LiveSocket,
} from "../providers/deepgram-live";
import { runTurn, type RunTurnDeps } from "./run-turn";
import { canUseLiveVoice } from "../lib/voice-entitlement";
import type { Verifier } from "../middleware/auth";
import type { ChatMessage } from "../providers/openai";

// Everything the route needs to run one Live turn for a given connection: the
// target language and a function that turns the user's utterance into the full
// LLM message list (system prompt + history + utterance). Loaded per-connection
// after auth so the relay stays generic.
export type LiveTurnContext = {
  languageCode: string;
  buildMessages: (transcript: string) => ChatMessage[];
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

  const send = (msg: unknown) => ws?.send(JSON.stringify(msg));

  const runOneTurn = async (utterance: string) => {
    const turn = new AbortController();
    currentTurn = turn;
    send({ type: "user-transcript", text: utterance });
    await runTurn(
      deps.runTurnDeps,
      {
        messages: params.ctx.buildMessages(utterance),
        languageCode: params.ctx.languageCode,
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
    if (!turn.signal.aborted) send({ type: "turn-done" });
  };

  return {
    onOpen: async (socket: WsLike) => {
      ws = socket;
      live = await openLiveTranscription(
        { connect: deps.connectDeepgram },
        { languageCode: params.ctx.languageCode },
      );
      live.on("transcript", (p) => {
        const text = (p as { text: string }).text;
        if (text) transcriptParts.push(text);
      });
      live.on("utteranceEnd", () => {
        const utterance = transcriptParts.join(" ").trim();
        transcriptParts = [];
        if (utterance) void runOneTurn(utterance);
      });
      live.on("error", () =>
        send({ type: "error", code: "STT_PROVIDER_FAILURE" }),
      );
    },
    onMessage: (data: unknown, socket: WsLike) => {
      ws = socket;
      if (typeof data === "string") {
        try {
          const msg = JSON.parse(data) as { type?: string };
          if (msg?.type === "cancel") currentTurn?.abort();
        } catch {
          // ignore non-JSON text frames
        }
        return;
      }
      // Binary audio frame → Deepgram
      if (data instanceof ArrayBuffer) live?.sendAudio(data);
      else if (ArrayBuffer.isView(data))
        live?.sendAudio(data as ArrayBufferView);
    },
    onClose: () => {
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
