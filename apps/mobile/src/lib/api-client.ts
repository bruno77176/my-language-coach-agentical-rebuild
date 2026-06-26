import EventSource from "react-native-sse";
import { Platform } from "react-native";
import { supabase } from "./supabase";
import type { TtsConfig } from "@language-coach/shared";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  "https://my-language-coach-agentical-rebuild.fly.dev";

export async function authHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error("Not authenticated");
  return `Bearer ${data.session.access_token}`;
}

// X-Client-Platform tells the backend which platform invoked the request, so
// usage_events rows can be attributed correctly in the cost dashboard. The
// backend coerces unknown values to "unknown", so we just forward Platform.OS
// (ios | android | web).
export function clientPlatformHeader(): { "X-Client-Platform": string } {
  return { "X-Client-Platform": Platform.OS };
}

// Advertise that this build can play coach audio delivered inline (base64) in
// the reply-chunk SSE event. The backend then skips the Supabase Storage
// upload + signed-URL round-trip and the client skips the re-download — a full
// network round-trip removed from the latency-critical path per chunk. Older
// builds omit this header and transparently get the legacy signed-URL path.
export function clientCapabilitiesHeader(): {
  "X-Client-Capabilities": string;
} {
  return { "X-Client-Capabilities": "inline-audio" };
}

export type StartSessionResponse = {
  conversation_id: string;
  // Daily wall-clock budget so the client can enforce the cap locally + show a
  // countdown. Optional for back-compat with older API responses.
  daily_used_seconds?: number;
  daily_cap_seconds?: number;
  reset_at?: string;
  // Rewarded-ad extensions left today (1/day). Lets the limit screen disable
  // the "watch an ad" button across remounts.
  ad_extensions_remaining?: number;
};

/**
 * Thrown by startSession when the free daily wall-clock cap is already spent
 * (HTTP 429). Carries the reset instant for the limit screen's countdown.
 */
export class DailyQuotaError extends Error {
  readonly code = "DAILY_QUOTA_EXCEEDED";
  readonly resetAt?: string;
  constructor(resetAt?: string) {
    super("Daily limit reached");
    this.name = "DailyQuotaError";
    this.resetAt = resetAt;
  }
}

export function isDailyQuotaError(e: unknown): e is DailyQuotaError {
  return e instanceof DailyQuotaError;
}

export async function startSession(
  language: string,
  scenarioId?: string,
): Promise<StartSessionResponse> {
  const res = await fetch(`${API_BASE_URL}/v1/voice/sessions`, {
    method: "POST",
    headers: {
      authorization: await authHeader(),
      "content-type": "application/json",
      ...clientPlatformHeader(),
    },
    body: JSON.stringify({
      language,
      ...(scenarioId ? { scenario_id: scenarioId } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) {
      let resetAt: string | undefined;
      try {
        const j = JSON.parse(text) as { error?: { resetAt?: string } };
        resetAt = j.error?.resetAt;
      } catch {
        // body wasn't JSON — fall through with no resetAt
      }
      throw new DailyQuotaError(resetAt);
    }
    throw new Error(`startSession ${res.status}: ${text}`);
  }
  return res.json() as Promise<StartSessionResponse>;
}

export type AdExtensionResponse = {
  daily_used_seconds: number;
  daily_cap_seconds: number;
  reset_at: string;
  extensions_remaining: number;
};

/**
 * Grant a "+3 min" rewarded-ad extension. STUB for now — the backend doesn't
 * verify a real ad watch yet (real AdMob lands later); the caller invokes this
 * after a simulated watch. Throws on the 409 "no extensions left today".
 */
export async function adExtension(): Promise<AdExtensionResponse> {
  const res = await fetch(`${API_BASE_URL}/v1/voice/ad-extension`, {
    method: "POST",
    headers: {
      authorization: await authHeader(),
      ...clientPlatformHeader(),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`adExtension ${res.status}: ${text}`);
  }
  return res.json() as Promise<AdExtensionResponse>;
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
      headers: {
        authorization: await authHeader(),
        ...clientPlatformHeader(),
      },
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`endSession ${res.status}: ${text}`);
  }
  return res.json() as Promise<EndSessionResponse>;
}

export type PreviewVoiceResponse = {
  audioBase64: string;
  contentType: string;
};

// Dev Voice Lab: synthesize a short sample in an arbitrary TTS config.
export async function previewVoice(input: {
  languageCode: string;
  config: TtsConfig;
  text?: string;
}): Promise<PreviewVoiceResponse> {
  const res = await fetch(`${API_BASE_URL}/v1/voice/preview`, {
    method: "POST",
    headers: {
      authorization: await authHeader(),
      "content-type": "application/json",
      ...clientPlatformHeader(),
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`previewVoice ${res.status}: ${text}`);
  }
  return res.json() as Promise<PreviewVoiceResponse>;
}

export async function selfDeleteAccount(): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/v1/account-deletion/self`, {
    method: "POST",
    headers: {
      authorization: await authHeader(),
      ...clientPlatformHeader(),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`selfDeleteAccount ${res.status}: ${text}`);
  }
}

export type TurnEvent =
  | { type: "transcription"; text: string }
  | {
      type: "reply-chunk";
      index: number;
      text: string;
      // Legacy signed-URL path (older backend / non-inline clients).
      audioUrl?: string;
      // Inline-audio path: the synthesized bytes, base64-encoded.
      audioBase64?: string;
      contentType?: string;
      durationMs: number;
    }
  | { type: "done"; messageId: string }
  | {
      type: "error";
      code: string;
      message: string;
      retryable: boolean;
      // Present for DAILY_QUOTA_EXCEEDED — the local-midnight reset instant.
      resetAt?: string;
    };

type TurnEventName = "transcription" | "reply-chunk" | "done";

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
  voiceConfig?: TtsConfig,
  // Wall-clock seconds elapsed in the conversation since the previous turn. The
  // server clamps + accumulates this into the daily cap (the on-screen timer is
  // the metric, not transcribed speech).
  elapsedDeltaSeconds?: number,
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
  if (voiceConfig) {
    form.append("voice_config", JSON.stringify(voiceConfig));
  }
  if (
    typeof elapsedDeltaSeconds === "number" &&
    Number.isFinite(elapsedDeltaSeconds)
  ) {
    form.append(
      "elapsed_delta_seconds",
      String(Math.max(0, Math.round(elapsedDeltaSeconds))),
    );
  }

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
      headers: {
        authorization: auth,
        ...clientPlatformHeader(),
        ...clientCapabilitiesHeader(),
      },
      body: form,
    });

    es.addEventListener("transcription", (e) => {
      if (!e.data) return;
      const data = JSON.parse(e.data) as { text: string };
      push({ type: "transcription", text: data.text });
    });
    es.addEventListener("reply-chunk", (e) => {
      if (!e.data) return;
      const data = JSON.parse(e.data) as {
        index: number;
        text: string;
        audioUrl?: string;
        audioBase64?: string;
        contentType?: string;
        durationMs: number;
      };
      push({
        type: "reply-chunk",
        index: data.index,
        text: data.text,
        audioUrl: data.audioUrl,
        audioBase64: data.audioBase64,
        contentType: data.contentType,
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
      // Built-in error event: type "error" | "exception" | "timeout". The
      // backend may emit a custom-named "error" SSE event (JSON in `data`), and
      // a pre-stream Hono error (e.g. 429 DAILY_QUOTA_EXCEEDED, emitted before
      // the stream opens) arrives with the body in `message`, not `data` — so we
      // try both. Body shapes:
      //   - SSE custom error event: `{ code, message, retryable }`
      //   - Hono error response: `{ error: { code, message, resetAt? } }`
      const rawStr =
        (e as { data?: string | null }).data ??
        (e as { message?: string }).message ??
        "";
      if (rawStr) {
        try {
          const parsed = JSON.parse(rawStr) as {
            code?: string;
            message?: string;
            retryable?: boolean;
            resetAt?: string;
            error?: {
              code?: string;
              message?: string;
              retryable?: boolean;
              resetAt?: string;
            };
          };
          const flat = parsed.error ?? parsed;
          push({
            type: "error",
            code: flat.code ?? "INTERNAL",
            message: flat.message ?? "Stream error",
            retryable: flat.retryable ?? false,
            resetAt: flat.resetAt,
          });
        } catch {
          push({
            type: "error",
            code: "INTERNAL",
            message: rawStr || "Stream error",
            retryable: true,
          });
        }
      } else {
        push({
          type: "error",
          code: "INTERNAL",
          message: "Stream error",
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

/**
 * POST to the scenario opening endpoint and consume the SSE response as an
 * AsyncIterable of TurnEvents. Same protocol as streamTurn but with NO request
 * body (no audio) and NO transcription event — the coach simply speaks first.
 */
export function streamOpening(conversationId: string): {
  events: AsyncIterable<TurnEvent>;
  close: () => void;
} {
  const url = `${API_BASE_URL}/v1/voice/sessions/${conversationId}/opening`;

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
      headers: {
        authorization: auth,
        ...clientPlatformHeader(),
        ...clientCapabilitiesHeader(),
      },
    });

    es.addEventListener("reply-chunk", (e) => {
      if (!e.data) return;
      const data = JSON.parse(e.data) as {
        index: number;
        text: string;
        audioUrl?: string;
        audioBase64?: string;
        contentType?: string;
        durationMs: number;
      };
      push({
        type: "reply-chunk",
        index: data.index,
        text: data.text,
        audioUrl: data.audioUrl,
        audioBase64: data.audioBase64,
        contentType: data.contentType,
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
      const maybeData = (e as { data?: string | null }).data;
      if (maybeData) {
        try {
          const raw = JSON.parse(maybeData) as
            | { code?: string; message?: string; retryable?: boolean }
            | {
                error?: {
                  code?: string;
                  message?: string;
                  retryable?: boolean;
                };
              };
          const flat =
            "error" in raw && raw.error
              ? raw.error
              : (raw as {
                  code?: string;
                  message?: string;
                  retryable?: boolean;
                });
          push({
            type: "error",
            code: flat.code ?? "INTERNAL",
            message: flat.message ?? "Stream error",
            retryable: flat.retryable ?? false,
          });
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
        push({ type: "error", code: "INTERNAL", message, retryable: true });
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

  return { events: events(), close: endStream };
}
