import {
  API_BASE_URL,
  authHeader,
  clientPlatformHeader,
} from "@/src/lib/api-client";

export async function translateMessageApi(
  messageId: string,
): Promise<{ translation: string }> {
  const res = await fetch(
    `${API_BASE_URL}/v1/messages/${messageId}/translate`,
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
    throw new Error(`translate ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ translation: string }>;
}
