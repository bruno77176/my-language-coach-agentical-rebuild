import {
  API_BASE_URL,
  authHeader,
  clientPlatformHeader,
} from "@/src/lib/api-client";

/** The ids of quotes the user has liked (BRU-9). */
export async function fetchQuoteLikes(): Promise<string[]> {
  const res = await fetch(`${API_BASE_URL}/v1/quotes/likes`, {
    headers: { authorization: await authHeader(), ...clientPlatformHeader() },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetchQuoteLikes ${res.status}: ${text}`);
  }
  const body = (await res.json()) as { quoteIds: string[] };
  return body.quoteIds;
}

export async function setQuoteLiked(
  quoteId: string,
  liked: boolean,
): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/v1/quotes/${encodeURIComponent(quoteId)}/like`,
    {
      method: liked ? "PUT" : "DELETE",
      headers: { authorization: await authHeader(), ...clientPlatformHeader() },
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`setQuoteLiked ${res.status}: ${text}`);
  }
}
