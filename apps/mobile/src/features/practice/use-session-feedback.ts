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
      const status = q.state.data?.status;
      // Keep polling while the coach generates feedback. "missing" means the
      // pending row hasn't committed yet — the checkpoint response can beat the
      // fire-and-forget feedback insert — so poll until it appears (bounded, so
      // a genuinely absent row doesn't poll forever). Was: stopped on "missing",
      // which left the screen permanently blank.
      if (status === "pending") return 1500;
      if (status === "missing" && q.state.dataUpdateCount < 30) return 1500;
      return false;
    },
    queryFn: () => fetchFeedback(id!, kind),
  });
}
