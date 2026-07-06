import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { configureForPlayback } from "@/src/lib/audio-session";

/**
 * App-wide single-player audio controller.
 *
 * ONE native player is created for the whole app and reused for every sound
 * (greeting, coach chunks, per-message repeat) via `player.replace(source)`.
 *
 * Why one player: the previous implementation called `createAudioPlayer()` per
 * sentence and `.remove()`d it on finish, but expo-audio doesn't free the native
 * player immediately — so over a long conversation the instances piled up and,
 * after ~30 (≈ 7-8 minutes of talking), the OS refused to start new ones and
 * coach audio silently died while text kept streaming. Reusing a single player
 * removes the leak entirely (verified: the server was still producing full audio
 * at the moment playback went silent, so the fault was device-side).
 *
 * A monotonically increasing `activeToken` identifies the current play; a newer
 * `playOnce` bumps it so an older play's status callbacks and timeout become
 * no-ops. `stopActivePlayer()`/`stopAllPlayback()` pause the shared player (they
 * never remove it) so it stays ready for the next sound.
 */

let sharedPlayer: AudioPlayer | null = null;

// Latch set when playback is hard-stopped (navigating away from Practice).
// While set, every playOnce is a no-op. Cleared by resumePlayback().
let playbackStopped = false;

// Identifies the currently-active play. Bumped by every playOnce and by
// stopActivePlayer, so a superseded/stopped play's callbacks stop acting.
let activeToken = 0;

function setVolume(p: AudioPlayer, v: number): void {
  try {
    (p as { volume?: number }).volume = v;
  } catch {
    // ignore
  }
}

/** Get the shared player, creating it on first use and swapping its source after. */
function ensurePlayer(source: { uri: string } | number): AudioPlayer {
  if (!sharedPlayer) {
    sharedPlayer = createAudioPlayer(source);
    return sharedPlayer;
  }
  try {
    sharedPlayer.replace(source);
  } catch {
    // replace failed (rare) — recreate as a last resort rather than go silent.
    try {
      sharedPlayer.remove();
    } catch {
      // ignore
    }
    sharedPlayer = createAudioPlayer(source);
  }
  return sharedPlayer;
}

export function stopActivePlayer(): void {
  // Invalidate any in-flight play so its callbacks/timeout stop acting, then
  // pause the shared player (volume=0 first because Android pause can lag).
  activeToken++;
  if (!sharedPlayer) return;
  setVolume(sharedPlayer, 0);
  try {
    sharedPlayer.pause();
  } catch {
    // ignore
  }
}

/**
 * Hard-stop all playback and latch playback off. Use when navigating away from
 * the Practice screen: the active play is stopped AND every subsequent playOnce
 * (queued chunks, or chunks an in-flight SSE stream is still enqueuing) becomes
 * a no-op until resumePlayback() is called.
 */
export function stopAllPlayback(): void {
  playbackStopped = true;
  stopActivePlayer();
}

/** Re-enable playback after a stopAllPlayback() (Practice screen regains focus). */
export function resumePlayback(): void {
  playbackStopped = false;
}

/**
 * Play a single audio source through the shared player. Resolves when audio
 * finishes OR after a hard timeout (estimated from text length / explicit
 * durationMs). Never creates a per-call player, so playback can't starve the
 * native audio system over a long session.
 */
export async function playOnce(input: {
  source: { uri: string } | number;
  text?: string;
  durationMs?: number;
  // Live mode: keep the existing record+playback (playAndRecord) audio session.
  // The default configureForPlayback() sets allowsRecording:false, which on iOS
  // switches the category to .playback and KILLS the always-on mic capture —
  // so after the first coach reply no more audio reaches Deepgram and it
  // idle-closes. Live passes true to keep the mic alive.
  keepSession?: boolean;
}): Promise<void> {
  if (playbackStopped) return;
  // This is now the active play; supersede any prior one.
  const myToken = ++activeToken;

  if (!input.keepSession) {
    try {
      await configureForPlayback();
    } catch {
      // best-effort
    }
  }
  // A stop or newer play may have landed while we awaited the session config.
  if (playbackStopped || myToken !== activeToken) return;

  const player = ensurePlayer(input.source);
  setVolume(player, 1);

  await new Promise<void>((resolve) => {
    let resolved = false;
    let triggered = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const finish = () => {
      if (resolved) return;
      resolved = true;
      if (timeoutId) clearTimeout(timeoutId);
      sub.remove();
      resolve();
    };

    const sub = player.addListener(
      "playbackStatusUpdate",
      (s: {
        isLoaded?: boolean;
        playing?: boolean;
        didJustFinish?: boolean;
      }) => {
        // A newer play (or a stop) took over — stop reacting to this source.
        if (myToken !== activeToken) {
          finish();
          return;
        }
        if (s.isLoaded && !triggered) {
          triggered = true;
          try {
            player.play();
          } catch {
            // ignore
          }
        }
        if (s.didJustFinish) finish();
      },
    );

    // Hard timeout fallback so a play always resolves (and its listener is
    // removed) even if the source never reports didJustFinish. Generous
    // (text length × 80ms ≈ speaking pace, plus 6s buffer).
    const estimatedMs =
      input.durationMs && input.durationMs > 0
        ? input.durationMs
        : Math.max(2500, (input.text?.length ?? 0) * 80);
    timeoutId = setTimeout(finish, estimatedMs + 6000);

    // Also try to start immediately — a bundled module (require result) may
    // already be loaded, so isLoaded won't fire.
    try {
      player.play();
    } catch {
      // ignore
    }
  });
}
