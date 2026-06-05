import { useQuery } from "@tanstack/react-query";
import {
  API_BASE_URL,
  authHeader,
  clientPlatformHeader,
} from "@/src/lib/api-client";

// Which voice modes this user may select (push_to_talk for everyone, +live for
// the server-side allowlist). Drives whether the mode switcher is shown.
async function fetchVoiceModes(): Promise<{ voiceModes: string[] }> {
  const res = await fetch(`${API_BASE_URL}/v1/voice/modes`, {
    headers: { authorization: await authHeader(), ...clientPlatformHeader() },
  });
  if (!res.ok) throw new Error(`voice-modes ${res.status}`);
  return res.json();
}

export function useAllowedVoiceModes() {
  return useQuery({ queryKey: ["voice-modes"], queryFn: fetchVoiceModes });
}
