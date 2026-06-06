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

// Decode base64 -> bytes WITHOUT atob: React Native's Hermes engine has no
// global atob (Node does, which is why this passed in tests but failed on
// device — every mic frame threw, so nothing was ever sent). Lookup-table
// decoder works on any JS engine and is fast enough for ~50 frames/sec.
const B64_LOOKUP = (() => {
  const t = new Uint8Array(256).fill(255);
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (let i = 0; i < chars.length; i++) t[chars.charCodeAt(i)] = i;
  return t;
})();

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  let len = b64.length;
  while (len > 0 && b64.charCodeAt(len - 1) === 61 /* '=' */) len--;
  const outLen = (len * 3) >> 2;
  const bytes = new Uint8Array(outLen);
  let o = 0;
  for (let i = 0; i < len; i += 4) {
    const a = B64_LOOKUP[b64.charCodeAt(i)]!;
    const b = B64_LOOKUP[b64.charCodeAt(i + 1)]!;
    const c = i + 2 < len ? B64_LOOKUP[b64.charCodeAt(i + 2)]! : 0;
    const d = i + 3 < len ? B64_LOOKUP[b64.charCodeAt(i + 3)]! : 0;
    bytes[o++] = (a << 2) | (b >> 4);
    if (o < outLen) bytes[o++] = ((b & 15) << 4) | (c >> 2);
    if (o < outLen) bytes[o++] = ((c & 3) << 6) | d;
  }
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
    // Best-effort client diagnostics surfaced in the backend (Fly) logs. The
    // socket may still be CONNECTING when early start()-phase logs fire, so a
    // failed send is swallowed — the on-screen mic readout is the source of
    // truth; this is the bonus server-side copy.
    sendLog(msg: string) {
      try {
        ws.send(JSON.stringify({ type: "client-log", msg }));
      } catch {
        // socket not open yet / already closed — ignore
      }
    },
    close() {
      ws.close();
    },
  };
}
