import { useQuery } from "@tanstack/react-query";
import {
  API_BASE_URL,
  authHeader,
  clientPlatformHeader,
} from "@/src/lib/api-client";

export type RecentSession = {
  id: string;
  language: string;
  scenarioId: string | null;
  startedAt: string;
  endedAt: string | null;
  secondsSpoken: number;
  feedbackStatus: "pending" | "ready" | "failed" | null;
};

async function fetchRecent(): Promise<{ sessions: RecentSession[] }> {
  const auth = await authHeader();
  const res = await fetch(`${API_BASE_URL}/v1/voice/sessions/recent`, {
    headers: { authorization: auth, ...clientPlatformHeader() },
  });
  if (!res.ok) {
    throw new Error(`recent-sessions ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export function useRecentSessions() {
  return useQuery({
    queryKey: ["recent-sessions"],
    queryFn: fetchRecent,
  });
}
