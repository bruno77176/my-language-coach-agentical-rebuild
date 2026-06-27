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

async function fetchTranscript(
  conversationId: string,
): Promise<ConversationTranscript> {
  const res = await fetch(
    `${API_BASE_URL}/v1/voice/sessions/${conversationId}/messages`,
    {
      headers: { authorization: await authHeader(), ...clientPlatformHeader() },
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetchTranscript ${res.status}: ${text}`);
  }
  return res.json() as Promise<ConversationTranscript>;
}

export function useConversationTranscript(conversationId: string | undefined) {
  return useQuery({
    queryKey: ["conversation-transcript", conversationId ?? ""] as const,
    queryFn: () => fetchTranscript(conversationId!),
    enabled: !!conversationId,
  });
}
