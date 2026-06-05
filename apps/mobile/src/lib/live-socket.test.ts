import { describe, it, expect, vi } from "vitest";
import { createLiveSocket } from "./live-socket";

function fakeWs() {
  return {
    send: vi.fn(),
    close: vi.fn(),
    onopen: null as null | ((ev: unknown) => void),
    onmessage: null as null | ((ev: { data: unknown }) => void),
    onclose: null as null | ((ev: { code: number }) => void),
    onerror: null as null | ((ev: unknown) => void),
  };
}

describe("createLiveSocket", () => {
  it("builds a wss URL with token + conversation_id", () => {
    let url = "";
    const ws = fakeWs();
    createLiveSocket({
      token: "tok 1",
      conversationId: "conv-9",
      callbacks: {},
      wsFactory: (u) => {
        url = u;
        return ws;
      },
    });
    expect(url.startsWith("wss://")).toBe(true);
    expect(url).toContain("/v1/voice/live?");
    expect(url).toContain("token=tok%201");
    expect(url).toContain("conversation_id=conv-9");
  });

  it("dispatches reply-chunk messages to onReplyChunk", () => {
    const ws = fakeWs();
    const onReplyChunk = vi.fn();
    createLiveSocket({
      token: "t",
      conversationId: "c",
      callbacks: { onReplyChunk },
      wsFactory: () => ws,
    });
    ws.onmessage?.({
      data: JSON.stringify({
        type: "reply-chunk",
        index: 0,
        text: "hi",
        audioBase64: "AAA=",
        contentType: "audio/mpeg",
      }),
    });
    expect(onReplyChunk).toHaveBeenCalledWith({
      index: 0,
      text: "hi",
      audioBase64: "AAA=",
      contentType: "audio/mpeg",
    });
  });

  it("sends mic audio as a binary frame decoded from base64", () => {
    const ws = fakeWs();
    const sock = createLiveSocket({
      token: "t",
      conversationId: "c",
      callbacks: {},
      wsFactory: () => ws,
    });
    sock.sendAudio(btoa("\x01\x02\x03"));
    expect(ws.send).toHaveBeenCalledTimes(1);
    const bytes = new Uint8Array(ws.send.mock.calls[0]![0] as ArrayBuffer);
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it("cancel() sends a JSON cancel control frame", () => {
    const ws = fakeWs();
    const sock = createLiveSocket({
      token: "t",
      conversationId: "c",
      callbacks: {},
      wsFactory: () => ws,
    });
    sock.cancel();
    expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "cancel" }));
  });

  it("routes error frames and socket errors to onError", () => {
    const ws = fakeWs();
    const onError = vi.fn();
    createLiveSocket({
      token: "t",
      conversationId: "c",
      callbacks: { onError },
      wsFactory: () => ws,
    });
    ws.onmessage?.({
      data: JSON.stringify({ type: "error", code: "STT_FAIL" }),
    });
    expect(onError).toHaveBeenCalledWith("STT_FAIL");
  });
});
