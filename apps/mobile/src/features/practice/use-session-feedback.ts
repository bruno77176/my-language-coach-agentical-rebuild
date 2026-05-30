import { useQuery } from "@tanstack/react-query";
import {
  API_BASE_URL,
  authHeader,
  clientPlatformHeader,
} from "@/src/lib/api-client";
import type { SessionFeedback } from "@language-coach/shared";

export type FeedbackResponse =
  | { status: "missing" }
  | { status: "pending" }
  | { status: "failed" }
  | ({ status: "ready" } & SessionFeedback);

async function fetchFeedback(
  conversationId: string,
): Promise<FeedbackResponse> {
  const res = await fetch(
    `${API_BASE_URL}/v1/sessions/${conversationId}/feedback`,
    {
      headers: {
        authorization: await authHeader(),
        ...clientPlatformHeader(),
      },
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetchFeedback ${res.status}: ${text}`);
  }
  return res.json() as Promise<FeedbackResponse>;
}

export function useSessionFeedback(conversationId: string | null) {
  return useQuery<FeedbackResponse>({
    queryKey: ["session-feedback", conversationId],
    enabled: !!conversationId,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (data && data.status === "pending") return 1500;
      return false;
    },
    queryFn: () => fetchFeedback(conversationId!),
  });
}
