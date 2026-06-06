import {
  API_BASE_URL,
  authHeader,
  clientPlatformHeader,
} from "@/src/lib/api-client";

export type VocabItem = {
  id: string;
  language: string;
  term: string;
  translation: string | null;
  mastery: number;
  createdAt: string;
};

export type VocabDeckResponse = { items: VocabItem[]; dueCount: number };
export type ReviewResult = "got_it" | "still_learning";

export async function fetchVocabDeck(
  language: string,
): Promise<VocabDeckResponse> {
  const res = await fetch(
    `${API_BASE_URL}/v1/vocab?language=${encodeURIComponent(language)}`,
    {
      headers: {
        authorization: await authHeader(),
        ...clientPlatformHeader(),
      },
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetchVocabDeck ${res.status}: ${text}`);
  }
  return res.json() as Promise<VocabDeckResponse>;
}

export async function addVocab(input: {
  language: string;
  term: string;
  translation?: string;
}): Promise<{ item: VocabItem }> {
  const res = await fetch(`${API_BASE_URL}/v1/vocab`, {
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
    throw new Error(`addVocab ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ item: VocabItem }>;
}

export async function reviewVocab(
  id: string,
  result: ReviewResult,
): Promise<{ item: VocabItem }> {
  const res = await fetch(`${API_BASE_URL}/v1/vocab/${id}`, {
    method: "PATCH",
    headers: {
      authorization: await authHeader(),
      "content-type": "application/json",
      ...clientPlatformHeader(),
    },
    body: JSON.stringify({ result }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`reviewVocab ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ item: VocabItem }>;
}

export async function removeVocab(id: string): Promise<{ ok: true }> {
  const res = await fetch(`${API_BASE_URL}/v1/vocab/${id}`, {
    method: "DELETE",
    headers: {
      authorization: await authHeader(),
      ...clientPlatformHeader(),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`removeVocab ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ ok: true }>;
}
