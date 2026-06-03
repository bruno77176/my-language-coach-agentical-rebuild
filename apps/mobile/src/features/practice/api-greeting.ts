import type { TtsConfig } from "@language-coach/shared";
import {
  API_BASE_URL,
  authHeader,
  clientPlatformHeader,
} from "@/src/lib/api-client";

export async function fetchGreetingAudio(input: {
  lang: string;
  name: string;
  config?: TtsConfig;
}): Promise<{ audioUrl: string }> {
  const res = await fetch(`${API_BASE_URL}/v1/voice/greeting/audio`, {
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
    throw new Error(`greeting audio ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ audioUrl: string }>;
}
