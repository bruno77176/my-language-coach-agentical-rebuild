import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  API_BASE_URL,
  authHeader,
  clientPlatformHeader,
} from "@/src/lib/api-client";
import type { CoachMemory } from "@language-coach/shared";

export function useUpdateMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      languageCode: string;
      memory: CoachMemory;
    }) => {
      const res = await fetch(`${API_BASE_URL}/v1/memory`, {
        method: "PUT",
        headers: {
          authorization: await authHeader(),
          "content-type": "application/json",
          ...clientPlatformHeader(),
        },
        body: JSON.stringify({
          language_code: input.languageCode,
          memory: input.memory,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`updateMemory ${res.status}: ${text}`);
      }
      return res.json() as Promise<{ ok: true }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coach-memory"] }),
  });
}

export function useDeleteMemory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (languageCode: string) => {
      const res = await fetch(`${API_BASE_URL}/v1/memory/${languageCode}`, {
        method: "DELETE",
        headers: {
          authorization: await authHeader(),
          ...clientPlatformHeader(),
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`deleteMemory ${res.status}: ${text}`);
      }
      return res.json() as Promise<{ ok: true }>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coach-memory"] }),
  });
}
