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

function safePause(p: AudioPlayer): void {
  try {
    p.pause();
  } catch {
    // ignore
  }
}

function safeRemove(p: AudioPlayer): void {
  try {
    p.remove();
  } catch {
    // ignore
  }
}

export function setActivePlayer(player: AudioPlayer): void {
  if (currentPlayer && currentPlayer !== player) {
    safePause(currentPlayer);
    safeRemove(currentPlayer);
  }
  currentPlayer = player;
}

export function stopActivePlayer(): void {
  if (!currentPlayer) return;
  safePause(currentPlayer);
  safeRemove(currentPlayer);
  currentPlayer = null;
}

export function clearActivePlayerIfMatches(player: AudioPlayer): void {
  if (currentPlayer === player) {
    currentPlayer = null;
  }
}
