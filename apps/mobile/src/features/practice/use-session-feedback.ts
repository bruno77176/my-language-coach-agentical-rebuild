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

export type FeedbackKind = "session" | "checkpoint";

async function fetchFeedback(
  id: string,
  kind: FeedbackKind,
): Promise<FeedbackResponse> {
  const path =
    kind === "checkpoint"
      ? `/v1/checkpoints/${id}/feedback`
      : `/v1/sessions/${id}/feedback`;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      authorization: await authHeader(),
      ...clientPlatformHeader(),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetchFeedback ${res.status}: ${text}`);
  }
  return res.json() as Promise<FeedbackResponse>;
}

export function useSessionFeedback(
  id: string | null,
  kind: FeedbackKind = "session",
) {
  return useQuery<FeedbackResponse>({
    queryKey: ["session-feedback", kind, id],
    enabled: !!id,
    refetchInterval: (q) => {
      const data = q.state.data;
      if (data && data.status === "pending") return 1500;
      return false;
    },
    queryFn: () => fetchFeedback(id!, kind),
  });
}
