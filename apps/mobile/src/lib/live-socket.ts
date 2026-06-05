// WebSocket client for the Live voice route (/v1/voice/live). Streams mic PCM
// frames to the backend and dispatches the coach reply messages. Kept free of
// supabase/native imports so it unit-tests in isolation; the caller supplies
// the access token and conversation id.

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "https://my-language-coach-agentical-rebuild.fly.dev";

export const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");

export type LiveReplyChunk = {
  index: number;
  text: string;
  audioBase64: string;
  contentType: string;
};

export type LiveSocketCallbacks = {
  onUserTranscript?: (text: string) => void;
  onReplyChunk?: (chunk: LiveReplyChunk) => void;
  onTurnDone?: () => void;
  onError?: (code: string) => void;
  onClose?: (code: number) => void;
};

export interface WebSocketLike {
  send(data: string | ArrayBuffer): void;
  close(code?: number, reason?: string): void;
  onopen: ((ev: unknown) => void) | null;
  onmessage: ((ev: { data: unknown }) => void) | null;
  onerror: ((ev: unknown) => void) | null;
  onclose: ((ev: { code: number }) => void) | null;
}

export type LiveWsFactory = (url: string) => WebSocketLike;

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = (globalThis as unknown as { atob: (s: string) => string }).atob(
    b64,
  );
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function createLiveSocket(opts: {
  token: string;
  conversationId: string;
  callbacks: LiveSocketCallbacks;
  wsFactory?: LiveWsFactory;
}) {
  const url =
    `${WS_BASE_URL}/v1/voice/live?token=${encodeURIComponent(opts.token)}` +
    `&conversation_id=${encodeURIComponent(opts.conversationId)}`;
  const factory: LiveWsFactory =
    opts.wsFactory ?? ((u) => new WebSocket(u) as unknown as WebSocketLike);
  const ws = factory(url);
  const cb = opts.callbacks;

  ws.onmessage = (ev) => {
    let msg: { type?: string; [k: string]: unknown };
    try {
      msg = JSON.parse(ev.data as string);
    } catch {
      return;
    }
    switch (msg.type) {
      case "user-transcript":
        cb.onUserTranscript?.(String(msg.text ?? ""));
        break;
      case "reply-chunk":
        cb.onReplyChunk?.({
          index: Number(msg.index),
          text: String(msg.text ?? ""),
          audioBase64: String(msg.audioBase64 ?? ""),
          contentType: String(msg.contentType ?? "audio/mpeg"),
        });
        break;
      case "turn-done":
        cb.onTurnDone?.();
        break;
      case "error":
        cb.onError?.(String(msg.code ?? "ERROR"));
        break;
    }
  };
  ws.onerror = () => cb.onError?.("WS_ERROR");
  ws.onclose = (ev) => cb.onClose?.(ev.code);

  return {
    sendAudio(base64: string) {
      ws.send(base64ToArrayBuffer(base64));
    },
    cancel() {
      ws.send(JSON.stringify({ type: "cancel" }));
    },
    close() {
      ws.close();
    },
  };
}
