import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useAudioRecorderState } from "expo-audio";
import { palette, spacing } from "@language-coach/design-tokens";

const BARS = 30;
const FLOOR_DB = -55; // below this counts as silence

// Recorder metering is dBFS (~ -160..0). Map [FLOOR_DB, 0] → [0, 1].
function normalize(metering: number | undefined): number {
  if (metering == null || !Number.isFinite(metering)) return 0;
  const clamped = Math.max(FLOOR_DB, Math.min(0, metering));
  return (clamped - FLOOR_DB) / -FLOOR_DB;
}

/**
 * Live amplitude waveform shown while recording (BRU-44) — makes voice feel
 * responsive before any transcription returns, and masks the cascade latency.
 */
export function RecordingWaveform({
  recorder,
}: {
  recorder: Parameters<typeof useAudioRecorderState>[0];
}) {
  // Poll the recorder ~11×/s for a smooth scroll.
  const state = useAudioRecorderState(recorder, 90);
  const [bars, setBars] = useState<number[]>(() => Array(BARS).fill(0));

  // durationMillis ticks every poll while recording → advance the bar history.
  useEffect(() => {
    setBars((prev) => [...prev.slice(1), normalize(state?.metering)]);
  }, [state?.durationMillis, state?.metering]);

  return (
    <View style={styles.row}>
      {bars.map((b, i) => (
        <View key={i} style={[styles.bar, { height: 3 + b * 26 }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    height: 32,
    marginBottom: spacing.sm,
  },
  bar: {
    width: 3,
    borderRadius: 2,
    backgroundColor: palette.accent,
  },
});
