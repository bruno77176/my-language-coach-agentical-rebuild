/**
 * Cheap silence heuristic for v1.
 *
 * Server-side AUDIO_SILENT detection is the source of truth; this just
 * skips the round-trip when audio is obviously empty.
 */
export type SilenceSignals = {
  durationMs: number | undefined;
  fileSizeBytes: number;
};

const MIN_DURATION_MS = 500;
const MIN_FILE_BYTES = 2000;

export function isLikelySilent(signals: SilenceSignals): boolean {
  if (signals.fileSizeBytes < MIN_FILE_BYTES) return true;
  if (
    signals.durationMs !== undefined &&
    signals.durationMs < MIN_DURATION_MS
  ) {
    return true;
  }
  return false;
}
