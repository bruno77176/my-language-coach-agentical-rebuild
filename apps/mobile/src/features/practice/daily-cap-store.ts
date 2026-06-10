import { create } from "zustand";

/**
 * Live daily wall-clock budget for the current session, so the Practice screen
 * can stop the conversation the instant the on-screen timer reaches the cap
 * (client-side enforcement) and the daily-limit screen can extend it after a
 * rewarded-ad grant — without either re-fetching from the server.
 *
 * Effective remaining = capSeconds - usedAtStartSeconds + bonusSeconds, compared
 * against the session timer. `usedAtStartSeconds` is the snapshot at session
 * start; the session timer approximates the growth during the session, so we do
 * NOT also add server-side growth (that would double-count).
 */
type DailyCapState = {
  capSeconds: number | null; // null = unknown (older API / not loaded) → no client enforcement
  usedAtStartSeconds: number;
  bonusSeconds: number; // granted by rewarded-ad extensions this session
  resetAt: string | null;
  setBudget: (b: { cap: number; used: number; resetAt: string | null }) => void;
  addBonus: (seconds: number) => void;
  clear: () => void;
};

export const useDailyCap = create<DailyCapState>((set) => ({
  capSeconds: null,
  usedAtStartSeconds: 0,
  bonusSeconds: 0,
  resetAt: null,
  setBudget: (b) =>
    set({
      capSeconds: b.cap,
      usedAtStartSeconds: b.used,
      bonusSeconds: 0,
      resetAt: b.resetAt,
    }),
  addBonus: (seconds) =>
    set((s) => ({ bonusSeconds: s.bonusSeconds + seconds })),
  clear: () =>
    set({
      capSeconds: null,
      usedAtStartSeconds: 0,
      bonusSeconds: 0,
      resetAt: null,
    }),
}));

// +3 min granted per rewarded-ad watch (mirrors the server's AD_EXTENSION_SECONDS).
export const AD_EXTENSION_SECONDS = 180;
