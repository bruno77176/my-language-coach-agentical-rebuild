import EventSource from "react-native-sse";
import { supabase } from "./supabase";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "https://my-language-coach-agentical-rebuild.fly.dev";

export async function authHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Not authenticated");
  return `Bearer ${data.session.access_token}`;
}

export type StartSessionResponse = { conversation_id: string };

export async function startSession(
  language: string,
): Promise<StartSessionResponse> {
  const res = await fetch(`${API_BASE_URL}/v1/voice/sessions`, {
    method: "POST",
    headers: {
      authorization: await authHeader(),
      "content-type": "application/json",
    },
    body: JSON.stringify({ language }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`startSession ${res.status}: ${text}`);
  }
  return res.json() as Promise<StartSessionResponse>;
}

export type EndSessionResponse = {
  seconds_spoken: number;
  goal_reached: boolean;
};

export async function endSession(
  conversationId: string,
): Promise<EndSessionResponse> {
  const res = await fetch(
    `${API_BASE_URL}/v1/voice/sessions/${conversationId}/end`,
    {
      method: "POST",
      headers: { authorization: await authHeader() },
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`endSession ${res.status}: ${text}`);
  }
  return res.json() as Promise<EndSessionResponse>;
}

export type TurnEvent =
  | { type: "transcription"; text: string }
  | { type: "reply-text-delta"; delta: string }
  | { type: "reply-audio"; audioUrl: string; durationMs: number }
  | { type: "done"; messageId: string }
  | { type: "error"; code: string; message: string; retryable: boolean };

type TurnEventName =
  | "transcription"
  | "reply-text-delta"
  | "reply-audio"
  | "done";

/**
 * POST audio to the turn endpoint and consume the SSE response as an
 * AsyncIterable of events. Caller awaits each event and reacts (display
 * transcription, append delta text, play audio when arriving, etc.).
 *
 * This is gnarly — react-native-sse is callback-based and we wrap it as
 * an async iterable. Refactor candidate for Plan 7.
 */
export function streamTurn(
  conversationId: string,
  audioUri: string,
): {
  events: AsyncIterable<TurnEvent>;
  close: () => void;
} {
  // RN's FormData supports the `{ uri, name, type }` file shape that the
  // platform serializes correctly for fetch and react-native-sse. Cast
  // through `unknown` because the file-part shape isn't in the lib.dom
  // FormData typings.
  const form = new FormData();
  form.append("audio", {
    uri: audioUri,
    name: "recording.m4a",
    type: "audio/m4a",
  } as unknown as Blob);

  const url = `${API_BASE_URL}/v1/voice/sessions/${conversationId}/turns`;

  let es: EventSource<TurnEventName> | null = null;
  let open = true;
  const queue: TurnEvent[] = [];
  let resolveNext: ((e: TurnEvent | null) => void) | null = null;

  function push(e: TurnEvent) {
    if (!open) return;
    if (resolveNext) {
      resolveNext(e);
      resolveNext = null;
    } else queue.push(e);
  }

  function endStream() {
    open = false;
    es?.close();
    if (resolveNext) {
      resolveNext(null);
      resolveNext = null;
    }
  }

  // Async startup — auth header lookup is async. Build the EventSource
  // once we have the JWT, then attach listeners.
  void (async () => {
    let auth: string;
    try {
      auth = await authHeader();
    } catch (err) {
      push({
        type: "error",
        code: "UNAUTHORIZED",
        message: (err as Error).message,
        retryable: false,
      });
      endStream();
      return;
    }

    es = new EventSource<TurnEventName>(url, {
      method: "POST",
      headers: { authorization: auth },
      body: form,
    });

    es.addEventListener("transcription", (e) => {
      if (!e.data) return;
      const data = JSON.parse(e.data) as { text: string };
      push({ type: "transcription", text: data.text });
    });
    es.addEventListener("reply-text-delta", (e) => {
      if (!e.data) return;
      const data = JSON.parse(e.data) as { delta: string };
      push({ type: "reply-text-delta", delta: data.delta });
    });
    es.addEventListener("reply-audio", (e) => {
      if (!e.data) return;
      const data = JSON.parse(e.data) as {
        audioUrl: string;
        durationMs: number;
      };
      push({
        type: "reply-audio",
        audioUrl: data.audioUrl,
        durationMs: data.durationMs,
      });
    });
    es.addEventListener("done", (e) => {
      if (e.data) {
        const data = JSON.parse(e.data) as { messageId: string };
        push({ type: "done", messageId: data.messageId });
      } else {
        push({ type: "done", messageId: "" });
      }
      endStream();
    });
    es.addEventListener("error", (e) => {
      // Built-in error event: type "error" | "exception" | "timeout".
      // The backend may also emit a custom-named "error" event with a
      // JSON payload; react-native-sse merges those into the same handler.
      const maybeData = (e as { data?: string | null }).data;
      if (maybeData) {
        try {
          const data = JSON.parse(maybeData) as {
            code: string;
            message: string;
            retryable: boolean;
          };
          push({ type: "error", ...data });
        } catch {
          push({
            type: "error",
            code: "INTERNAL",
            message: "Stream error",
            retryable: true,
          });
        }
      } else {
        const message = (e as { message?: string }).message ?? "Stream error";
        push({
          type: "error",
          code: "INTERNAL",
          message,
          retryable: true,
        });
      }
      endStream();
    });
  })();

  async function* events(): AsyncIterable<TurnEvent> {
    while (open || queue.length) {
      if (queue.length) {
        const next = queue.shift()!;
        yield next;
        if (next.type === "done" || next.type === "error") return;
        continue;
      }
      const next = await new Promise<TurnEvent | null>(
        (r) => (resolveNext = r),
      );
      if (!next) return;
      yield next;
      if (next.type === "done" || next.type === "error") return;
    }
  }

  return {
    events: events(),
    close: endStream,
  };
}
