import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  API_BASE_URL,
  authHeader,
  clientPlatformHeader,
} from "@/src/lib/api-client";
import type { FeedbackKind, FeedbackResponse } from "./use-session-feedback";

async function postRetry(id: string, kind: FeedbackKind): Promise<void> {
  const path =
    kind === "checkpoint"
      ? `/v1/checkpoints/${id}/feedback/retry`
      : `/v1/sessions/${id}/feedback/retry`;
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      authorization: await authHeader(),
      ...clientPlatformHeader(),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`retryFeedback ${res.status}: ${text}`);
  }
}

/**
 * Regenerate a FAILED feedback report. The backend flips the row back to
 * `pending` and re-runs generation in the background; we optimistically set the
 * cached feedback to `pending` so `useSessionFeedback`'s poll resumes and the
 * screen shows the "preparing feedback…" spinner until it lands ready/failed.
 */
export function useRetryFeedback(id: string | null, kind: FeedbackKind) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("No feedback to retry");
      await postRetry(id, kind);
    },
    onSuccess: () => {
      qc.setQueryData<FeedbackResponse>(["session-feedback", kind, id], {
        status: "pending",
      });
    },
  });
}
