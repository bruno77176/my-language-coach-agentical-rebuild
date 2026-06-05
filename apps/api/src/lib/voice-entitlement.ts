// Allowlist gating for advanced voice modes (Live / speech-to-speech). For now
// an explicit list of user IDs (Bruno's, while testing); later this is driven
// by subscription tier. Mirrors the ADMIN_USER_IDS pattern.
export function parseLiveVoiceIds(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function canUseLiveVoice(userId: string, allowlist: string[]): boolean {
  return allowlist.includes(userId);
}
