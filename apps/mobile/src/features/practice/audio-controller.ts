import type { AudioPlayer } from "expo-audio";

/**
 * App-wide single-player rule: only one piece of audio plays at a time.
 *
 * Whenever any code (greeting flow, chunk queue, MessageBubble repeat)
 * starts a new player, it calls `setActivePlayer(player)` — which pauses
 * + releases any prior player. When the new player finishes, it calls
 * `clearActivePlayerIfMatches(player)` to release its slot.
 *
 * On screen blur (useFocusEffect cleanup) the practice screen calls
 * `stopActivePlayer()` so audio doesn't continue when the user navigates
 * away.
 */

let currentPlayer: AudioPlayer | null = null;

function safeStop(p: AudioPlayer): void {
  // Order matters: muting is the only operation that takes effect
  // immediately on Android. pause() and remove() can lag behind the native
  // audio buffer, leading to overlapping playback when called too fast.
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

export function setActivePlayer(player: AudioPlayer): void {
  if (currentPlayer && currentPlayer !== player) {
    safeStop(currentPlayer);
  }
  currentPlayer = player;
}

export function stopActivePlayer(): void {
  if (!currentPlayer) return;
  safeStop(currentPlayer);
  currentPlayer = null;
}

export function clearActivePlayerIfMatches(player: AudioPlayer): void {
  if (currentPlayer === player) {
    currentPlayer = null;
  }
}
