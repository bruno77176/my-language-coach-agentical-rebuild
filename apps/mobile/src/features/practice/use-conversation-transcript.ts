import { useQuery } from "@tanstack/react-query";
import {
  API_BASE_URL,
  authHeader,
  clientPlatformHeader,
} from "@/src/lib/api-client";

export type TranscriptMessage = {
  id: string;
  role: "user" | "coach";
  text: string;
  translation: string | null;
  isGreeting: boolean;
  createdAt: string;
};

export type ConversationTranscript = {
  language: string;
  startedAt: string;
  messages: TranscriptMessage[];
};

export type TranscriptKind = "session" | "checkpoint";

async function fetchTranscript(
  id: string,
  kind: TranscriptKind,
): Promise<ConversationTranscript> {
  // A continuous-thread segment is scoped to its checkpoint range; a legacy/
  // scenario session is the whole conversation.
  const path =
    kind === "checkpoint"
      ? `/v1/voice/checkpoints/${id}/messages`
      : `/v1/voice/sessions/${id}/messages`;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { authorization: await authHeader(), ...clientPlatformHeader() },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetchTranscript ${res.status}: ${text}`);
  }
  return res.json() as Promise<ConversationTranscript>;
}

export function useConversationTranscript(
  id: string | undefined,
  kind: TranscriptKind = "session",
) {
  return useQuery({
    queryKey: ["conversation-transcript", kind, id ?? ""] as const,
    queryFn: () => fetchTranscript(id!, kind),
    enabled: !!id,
  });
}
