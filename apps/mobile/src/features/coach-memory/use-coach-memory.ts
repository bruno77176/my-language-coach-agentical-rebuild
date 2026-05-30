import { useQuery } from "@tanstack/react-query";
import {
  API_BASE_URL,
  authHeader,
  clientPlatformHeader,
} from "@/src/lib/api-client";
import type { CoachMemory } from "@language-coach/shared";

export type CoachMemoryEntry = {
  language_code: string;
  opted_out: boolean;
  memory: CoachMemory;
  updated_at: string;
};

async function fetchCoachMemory(): Promise<{ memories: CoachMemoryEntry[] }> {
  const res = await fetch(`${API_BASE_URL}/v1/memory`, {
    headers: {
      authorization: await authHeader(),
      ...clientPlatformHeader(),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`fetchCoachMemory ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ memories: CoachMemoryEntry[] }>;
}

export function useCoachMemory() {
  return useQuery({
    queryKey: ["coach-memory"],
    queryFn: fetchCoachMemory,
  });
}
