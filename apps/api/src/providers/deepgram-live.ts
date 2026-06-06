import { deepgramModelForLanguage } from "./deepgram";

// Minimal shape of the @deepgram/sdk v5 live socket we depend on. Injectable so
// tests drive it with a fake (the real `connect` comes from
// `client.listen.v1.connect`, which resolves to a V1Socket).
export interface RawLiveSocket {
  on(
    event: "open" | "message" | "close" | "error",
    cb: (m: unknown) => void,
  ): void;
  // WebSocket readyState (1 === OPEN). The SDK's V1Socket exposes this; we read
  // it live before each send rather than trusting the one-shot "open" event,
  // which the SDK fires into a single handler that can be registered too late.
  readonly readyState?: number;
  // Starts the connection. @deepgram/sdk's listen.v1.connect() returns a socket
  // that is NOT auto-started (readyState stays CLOSED until you call this) —
  // without it the socket never opens, so no audio is ever transcribed.
  connect(): void;
  sendMedia(bytes: ArrayBuffer | ArrayBufferView): void;
  sendFinalize(msg?: unknown): void;
  close(): void;
}

export type ConnectFn = (
  args: Record<string, unknown>,
) => Promise<RawLiveSocket>;

export type LiveEvent =
  | "transcript"
  | "utteranceEnd"
  | "open"
  | "error"
  | "close";

export interface LiveSocket {
  on(event: LiveEvent, cb: (payload: unknown) => void): void;
  // True when the underlying socket's readyState is OPEN. Gate audio forwarding
  // on this (not the "open" event) so a missed/late open event can't deadlock.
  isOpen(): boolean;
  sendAudio(bytes: ArrayBuffer | ArrayBufferView): void;
  finalize(): void;
  close(): void;
}

export interface LiveOpts {
  languageCode: string;
  sampleRate?: number; // PCM sample rate the client streams; default 16000
}

// Opens a Deepgram streaming-transcription socket and adapts its raw messages
// into a small typed event surface: final `transcript`s and `utteranceEnd`
// (end-of-turn). Interim results are consumed for endpointing but not surfaced
// as transcripts.
export async function openLiveTranscription(
  deps: { connect: ConnectFn },
  opts: LiveOpts,
): Promise<LiveSocket> {
  const handlers: Partial<Record<LiveEvent, ((p: unknown) => void)[]>> = {};
  const fire = (e: LiveEvent, p?: unknown) =>
    (handlers[e] ?? []).forEach((h) => h(p));

  const sock = await deps.connect({
    model: deepgramModelForLanguage(opts.languageCode),
    language: opts.languageCode,
    encoding: "linear16",
    sample_rate: opts.sampleRate ?? 16000,
    interim_results: true,
    smart_format: true,
    vad_events: true,
    utterance_end_ms: 1000,
  });

  sock.on("open", () => fire("open"));
  // Forward the close payload (CloseEvent: code + reason) so the caller can log
  // exactly why Deepgram dropped the socket instead of a bare "closed".
  sock.on("close", (e) => fire("close", e));
  sock.on("error", (e) => fire("error", e));
  sock.on("message", (raw) => {
    const m = raw as {
      type?: string;
      is_final?: boolean;
      channel?: { alternatives?: { transcript?: string }[] };
    };
    if (m.type === "UtteranceEnd") {
      fire("utteranceEnd");
      return;
    }
    if (m.type === "Results" && m.is_final) {
      const text = m.channel?.alternatives?.[0]?.transcript ?? "";
      if (text.trim()) fire("transcript", { text });
    }
  });

  // Start the socket AFTER the message/open/close/error handlers above are
  // wired, so the "open" event and the first transcripts aren't missed. The SDK
  // socket is inert until this is called — the bug that made Live never respond.
  sock.connect();

  return {
    on: (e, cb) => {
      (handlers[e] ??= []).push(cb);
    },
    isOpen: () => sock.readyState === 1, // 1 === WebSocket.OPEN
    sendAudio: (bytes) => sock.sendMedia(bytes),
    finalize: () => sock.sendFinalize(),
    close: () => sock.close(),
  };
}
