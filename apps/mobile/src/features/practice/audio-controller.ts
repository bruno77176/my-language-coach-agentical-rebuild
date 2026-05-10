import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { configureForPlayback } from "@/src/lib/audio-session";

/**
 * App-wide single-player audio controller.
 *
 * One player at a time across the whole practice screen — greeting, coach
 * chunks, and per-message repeat all funnel through `playOnce` here. That
 * gives us:
 *
 * - Tapping a second sound stops the first immediately (volume=0 first
 *   because Android pause+remove can lag, letting the buffer finish).
 * - Every player has a guaranteed cleanup path (didJustFinish OR timeout),
 *   so no player can leak and starve the native audio session over time.
 * - `stopActivePlayer()` kills in-flight audio when navigating away.
 */

let currentPlayer: AudioPlayer | null = null;

function safeStop(p: AudioPlayer): void {
  try {
    (p as { volume?: number }).volume = 0;
  } catch {
    // ignore
  }
  try {
    p.pause();
  } catch {
    // ignore
  }
  try {
    p.remove();
  } catch {
    // ignore
  }
}

export function stopActivePlayer(): void {
  if (!currentPlayer) return;
  safeStop(currentPlayer);
  currentPlayer = null;
}

/**
 * Play a single audio source through the global slot. Resolves when audio
 * finishes OR after a hard timeout (estimated from text length / explicit
 * durationMs). Always cleans up the player — no leaks even if the audio
 * never reports `didJustFinish`.
 */
export async function playOnce(input: {
  source: { uri: string } | number;
  text?: string;
  durationMs?: number;
}): Promise<void> {
  // Stop any prior playback before creating a new player.
  stopActivePlayer();
  try {
    await configureForPlayback();
  } catch {
    // best-effort
  }
  const player = createAudioPlayer(input.source);
  currentPlayer = player;

  await new Promise<void>((resolve) => {
    let resolved = false;
    let triggered = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      if (timeoutId) clearTimeout(timeoutId);
      // Only release the slot if THIS player is still the active one (it may
      // have been displaced by a newer playOnce while we were waiting).
      if (currentPlayer === player) currentPlayer = null;
      try {
        player.remove();
      } catch {
        // ignore
      }
      resolve();
    };

    const sub = player.addListener(
      "playbackStatusUpdate",
      (s: {
        isLoaded?: boolean;
        playing?: boolean;
        didJustFinish?: boolean;
      }) => {
        if (s.isLoaded && !triggered) {
          triggered = true;
          try {
            player.play();
          } catch {
            // ignore
          }
        }
        if (s.didJustFinish) {
          sub.remove();
          finish();
        }
      },
    );

    // Hard timeout fallback so the player never leaks. The estimate is
    // generous (text length × 80ms = roughly speaking pace, plus 6s buffer)
    // because we'd rather wait too long than starve the audio session.
    const estimatedMs =
      input.durationMs && input.durationMs > 0
        ? input.durationMs
        : Math.max(2500, (input.text?.length ?? 0) * 80);
    timeoutId = setTimeout(() => {
      sub.remove();
      finish();
    }, estimatedMs + 6000);

    // Also try to start immediately — if the source is a bundled module
    // (require result), it may already be loaded, and isLoaded won't fire.
    try {
      player.play();
    } catch {
      // ignore
    }
  });
}
