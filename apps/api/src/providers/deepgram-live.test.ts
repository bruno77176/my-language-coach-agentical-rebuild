import { describe, it, expect, vi } from "vitest";
import { openLiveTranscription } from "./deepgram-live";

function fakeSocket() {
  const handlers: Record<string, ((m: unknown) => void)[]> = {};
  return {
    on: (e: string, cb: (m: unknown) => void) => {
      (handlers[e] ??= []).push(cb);
    },
    connect: vi.fn(),
    sendMedia: vi.fn(),
    sendFinalize: vi.fn(),
    sendKeepAlive: vi.fn(),
    close: vi.fn(),
    emit: (e: string, m?: unknown) => (handlers[e] ?? []).forEach((h) => h(m)),
  };
}

describe("openLiveTranscription", () => {
  it("forwards final transcripts and utterance-end to handlers", async () => {
    const sock = fakeSocket();
    const connect = vi.fn().mockResolvedValue(sock);
    const live = await openLiveTranscription(
      { connect },
      { languageCode: "es" },
    );

    const transcripts: string[] = [];
    let ended = false;
    live.on("transcript", (t) =>
      transcripts.push((t as { text: string }).text),
    );
    live.on("utteranceEnd", () => {
      ended = true;
    });

    sock.emit("message", {
      type: "Results",
      is_final: true,
      channel: { alternatives: [{ transcript: "hola mundo" }] },
    });
    sock.emit("message", { type: "UtteranceEnd" });

    expect(transcripts).toEqual(["hola mundo"]);
    expect(ended).toBe(true);
  });

  it("starts the socket by calling connect() (SDK sockets are inert otherwise)", async () => {
    const sock = fakeSocket();
    const connect = vi.fn().mockResolvedValue(sock);
    await openLiveTranscription({ connect }, { languageCode: "de" });
    expect(sock.connect).toHaveBeenCalledTimes(1);
  });

  it("ignores interim (non-final) results", async () => {
    const sock = fakeSocket();
    const connect = vi.fn().mockResolvedValue(sock);
    const live = await openLiveTranscription(
      { connect },
      { languageCode: "en" },
    );
    const transcripts: string[] = [];
    live.on("transcript", (t) =>
      transcripts.push((t as { text: string }).text),
    );

    sock.emit("message", {
      type: "Results",
      is_final: false,
      channel: { alternatives: [{ transcript: "partial" }] },
    });

    expect(transcripts).toEqual([]);
  });

  it("sends audio bytes via sendMedia", async () => {
    const sock = fakeSocket();
    const connect = vi.fn().mockResolvedValue(sock);
    const live = await openLiveTranscription(
      { connect },
      { languageCode: "en" },
    );
    const bytes = new Uint8Array([1, 2, 3]);
    live.sendAudio(bytes);
    expect(sock.sendMedia).toHaveBeenCalledWith(bytes);
  });

  it("requests linear16 @ 16kHz with the language's model and endpointing", async () => {
    const sock = fakeSocket();
    const connect = vi.fn().mockResolvedValue(sock);
    await openLiveTranscription({ connect }, { languageCode: "es" });
    expect(connect).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "es",
        encoding: "linear16",
        sample_rate: 16000,
        interim_results: true,
        vad_events: true,
      }),
    );
  });
});
