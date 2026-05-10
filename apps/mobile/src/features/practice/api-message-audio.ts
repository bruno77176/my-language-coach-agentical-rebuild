import { API_BASE_URL, authHeader } from "@/src/lib/api-client";

export async function fetchMessageAudio(
  messageId: string,
): Promise<{ audioUrl: string }> {
  const res = await fetch(`${API_BASE_URL}/v1/messages/${messageId}/audio`, {
    method: "POST",
    headers: { authorization: await authHeader() },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`message audio ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ audioUrl: string }>;
}
