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
  /** The sentence the word was saved from — shown in review for context. */
  sourceSentence: string | null;
  /** Definite article for gendered nouns (der/die/das, le/la, …), or null. */
  article: string | null;
  mastery: number;
  starred: boolean;
  createdAt: string;
};

/** The word as it should be shown/learnt — with its gender article if any. */
export function displayTerm(item: Pick<VocabItem, "term" | "article">): string {
  return item.article ? `${item.article} ${item.term}` : item.term;
}

export type VocabDeckResponse = {
  items: VocabItem[];
  dueCount: number;
  starredCount: number;
};
export type ReviewResult = "got_it" | "still_learning";

export async function fetchVocabDeck(
  language: string,
  starredOnly = false,
): Promise<VocabDeckResponse> {
  const qs = new URLSearchParams({ language });
  if (starredOnly) qs.set("starred", "true");
  const res = await fetch(`${API_BASE_URL}/v1/vocab?${qs.toString()}`, {
    headers: {
      authorization: await authHeader(),
      ...clientPlatformHeader(),
    },
  });
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
  /** The phrase the word was tapped from (BRU-11). */
  source_sentence?: string;
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

export async function setVocabStarred(
  id: string,
  starred: boolean,
): Promise<{ item: VocabItem }> {
  const res = await fetch(`${API_BASE_URL}/v1/vocab/${id}`, {
    method: "PATCH",
    headers: {
      authorization: await authHeader(),
      "content-type": "application/json",
      ...clientPlatformHeader(),
    },
    body: JSON.stringify({ starred }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`setVocabStarred ${res.status}: ${text}`);
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

export type PronounceResult = {
  correct: boolean;
  heard: string;
  item: VocabItem;
};

// Upload a short recording of the user pronouncing the term; the server
// transcribes + grades it and updates mastery.
export async function pronounceVocab(
  id: string,
  audioUri: string,
): Promise<PronounceResult> {
  const form = new FormData();
  form.append("audio", {
    uri: audioUri,
    name: "pronounce.m4a",
    type: "audio/m4a",
  } as unknown as Blob);

  const res = await fetch(`${API_BASE_URL}/v1/vocab/${id}/pronounce`, {
    method: "POST",
    headers: {
      authorization: await authHeader(),
      ...clientPlatformHeader(),
    },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`pronounceVocab ${res.status}: ${text}`);
  }
  return res.json() as Promise<PronounceResult>;
}
