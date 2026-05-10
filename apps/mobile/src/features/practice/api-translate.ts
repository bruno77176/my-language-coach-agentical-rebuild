import { API_BASE_URL, authHeader } from "@/src/lib/api-client";

export async function translateMessageApi(
  messageId: string,
): Promise<{ translation: string }> {
  const res = await fetch(
    `${API_BASE_URL}/v1/messages/${messageId}/translate`,
    {
      method: "POST",
      headers: { authorization: await authHeader() },
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`translate ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ translation: string }>;
}
