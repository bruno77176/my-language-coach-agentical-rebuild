import { useQuery } from "@tanstack/react-query";
import {
  API_BASE_URL,
  authHeader,
  clientPlatformHeader,
} from "@/src/lib/api-client";
import type { CoachMemory } from "@language-coach/shared";

export type CoachMemoryEntry = {
  language_code: string;
  memory: CoachMemory;
  updated_at: string;
};

export type CoachMemoryResponse = {
  memory_enabled: boolean;
  memories: CoachMemoryEntry[];
};

async function fetchCoachMemory(): Promise<CoachMemoryResponse> {
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
  return res.json() as Promise<CoachMemoryResponse>;
}

export function useCoachMemory() {
  return useQuery({
    queryKey: ["coach-memory"],
    queryFn: fetchCoachMemory,
  });
}
