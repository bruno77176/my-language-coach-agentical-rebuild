import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  API_BASE_URL,
  authHeader,
  clientPlatformHeader,
} from "@/src/lib/api-client";

export type UpdateConsentInput = {
  languageCode: string;
  optedOut: boolean;
};

async function updateMemoryConsent(input: UpdateConsentInput): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/v1/memory/consent`, {
    method: "PUT",
    headers: {
      authorization: await authHeader(),
      "content-type": "application/json",
      ...clientPlatformHeader(),
    },
    body: JSON.stringify({
      language_code: input.languageCode,
      opted_out: input.optedOut,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`updateMemoryConsent ${res.status}: ${text}`);
  }
}

export function useUpdateMemoryConsent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateMemoryConsent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach-memory"] });
    },
  });
}
