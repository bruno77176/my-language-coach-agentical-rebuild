// Allowlist gating for advanced voice modes (Live / speech-to-speech). For now
// an explicit list of user IDs (Bruno's, while testing); later this is driven
// by subscription tier. Mirrors the ADMIN_USER_IDS pattern.
export function parseLiveVoiceIds(raw: string | undefined | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function canUseLiveVoice(userId: string, allowlist: string[]): boolean {
  return allowlist.includes(userId);
}

// The voice modes a user may select. Push-to-talk is always available; Live is
// gated by the allowlist. (Speech-to-speech is added here when that tier ships.)
export function allowedVoiceModes(
  userId: string,
  liveAllowlist: string[],
): string[] {
  return canUseLiveVoice(userId, liveAllowlist)
    ? ["push_to_talk", "live"]
    : ["push_to_talk"];
}
