import { describe, it, expect, vi } from "vitest";
import { createLiveConnection, type LiveTurnContext } from "./voice-live";

// A fake Deepgram raw socket we can drive from the test.
function fakeRawSocket() {
  const handlers: Record<string, ((m: unknown) => void)[]> = {};
  return {
    on: (e: string, cb: (m: unknown) => void) => {
      (handlers[e] ??= []).push(cb);
    },
    sendMedia: vi.fn(),
    sendFinalize: vi.fn(),
    close: vi.fn(),
    emit: (e: string, m?: unknown) => (handlers[e] ?? []).forEach((h) => h(m)),
  };
}

function fakeWs() {
  return { send: vi.fn(), close: vi.fn() };
}

async function* oneSentence() {
  yield "Hola.";
}

const ctx: LiveTurnContext = {
  languageCode: "es",
  baseMessages: [{ role: "system", content: "sys" }],
};

function makeDeps(raw: ReturnType<typeof fakeRawSocket>) {
  return {
    connectDeepgram: vi.fn().mockResolvedValue(raw),
    runTurnDeps: {
      streamChatCompletion: () => oneSentence(),
      synthesizeSpeech: vi.fn().mockResolvedValue({
        audioBuffer: Buffer.from([7]),
        contentType: "audio/mpeg",
      }),
    },
  };
}

describe("createLiveConnection", () => {
  it("relays inbound audio bytes to Deepgram once its socket is open", async () => {
    const raw = fakeRawSocket();
    const conn = createLiveConnection(makeDeps(raw), { ctx });
    const ws = fakeWs();
    await conn.onOpen(ws);
    raw.emit("open"); // Deepgram socket is now OPEN
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    conn.onMessage(bytes, ws);
    expect(raw.sendMedia).toHaveBeenCalledWith(bytes);
  });

  it("drops inbound audio until Deepgram's socket is open", async () => {
    const raw = fakeRawSocket();
    const conn = createLiveConnection(makeDeps(raw), { ctx });
    const ws = fakeWs();
    await conn.onOpen(ws);
    // No "open" emitted yet — sending into a connecting socket would throw
    // "Socket is not open", so we must drop rather than forward.
    conn.onMessage(new Uint8Array([1, 2, 3]).buffer, ws);
    expect(raw.sendMedia).not.toHaveBeenCalled();
  });

  it("notifies the client when Deepgram closes (so the UI doesn't hang)", async () => {
    const raw = fakeRawSocket();
    const conn = createLiveConnection(makeDeps(raw), { ctx });
    const ws = fakeWs();
    await conn.onOpen(ws);
    raw.emit("close", { code: 1011, reason: "boom" });
    const sent = ws.send.mock.calls.map((c) => JSON.parse(c[0] as string));
    expect(
      sent.some((m) => m.type === "error" && m.code === "STT_CLOSED:1011"),
    ).toBe(true);
  });

  it("runs a turn on utterance-end and streams reply-chunks to the client", async () => {
    const raw = fakeRawSocket();
    const conn = createLiveConnection(makeDeps(raw), { ctx });
    const ws = fakeWs();
    await conn.onOpen(ws);

    raw.emit("message", {
      type: "Results",
      is_final: true,
      channel: { alternatives: [{ transcript: "buenos dias" }] },
    });
    raw.emit("message", { type: "UtteranceEnd" });
    await new Promise((r) => setTimeout(r, 0)); // let the async turn run

    const sent = ws.send.mock.calls.map((c) => JSON.parse(c[0] as string));
    expect(
      sent.some(
        (m) => m.type === "user-transcript" && m.text === "buenos dias",
      ),
    ).toBe(true);
    const chunk = sent.find((m) => m.type === "reply-chunk");
    expect(chunk).toMatchObject({ text: "Hola.", index: 0 });
    expect(chunk.audioBase64).toBe(Buffer.from([7]).toString("base64"));
    expect(sent.some((m) => m.type === "turn-done")).toBe(true);
  });

  it("aborts the in-flight turn on a cancel control message (barge-in)", async () => {
    const raw = fakeRawSocket();
    const deps = makeDeps(raw);
    // Make synth block until we abort, so cancel reaches the in-flight turn.
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    deps.runTurnDeps.synthesizeSpeech = vi.fn().mockImplementation(async () => {
      await gate;
      return { audioBuffer: Buffer.from([7]), contentType: "audio/mpeg" };
    });
    const conn = createLiveConnection(deps, { ctx });
    const ws = fakeWs();
    await conn.onOpen(ws);

    raw.emit("message", {
      type: "Results",
      is_final: true,
      channel: { alternatives: [{ transcript: "hi" }] },
    });
    raw.emit("message", { type: "UtteranceEnd" });
    await new Promise((r) => setTimeout(r, 0));

    conn.onMessage(JSON.stringify({ type: "cancel" }), ws);
    release();
    await new Promise((r) => setTimeout(r, 0));

    const sent = ws.send.mock.calls.map((c) => JSON.parse(c[0] as string));
    // The reply-chunk for the aborted sentence must not be sent.
    expect(sent.some((m) => m.type === "reply-chunk")).toBe(false);
  });

  it("closes the Deepgram socket on connection close", async () => {
    const raw = fakeRawSocket();
    const conn = createLiveConnection(makeDeps(raw), { ctx });
    const ws = fakeWs();
    await conn.onOpen(ws);
    conn.onClose();
    expect(raw.close).toHaveBeenCalled();
  });
});
