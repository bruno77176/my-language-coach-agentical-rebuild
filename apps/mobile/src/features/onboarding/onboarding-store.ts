import { create } from "zustand";

type OnboardingState = {
  displayName: string;
  nativeLang: string;
  targetLang: string;
  dailyGoalMinutes: number;
  setDisplayName: (v: string) => void;
  setNativeLang: (v: string) => void;
  setTargetLang: (v: string) => void;
  setDailyGoalMinutes: (v: number) => void;
  reset: () => void;
};

const initial = {
  displayName: "",
  nativeLang: "",
  targetLang: "",
  dailyGoalMinutes: 10,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initial,
  setDisplayName: (displayName) => set({ displayName }),
  setNativeLang: (nativeLang) => set({ nativeLang }),
  setTargetLang: (targetLang) => set({ targetLang }),
  setDailyGoalMinutes: (dailyGoalMinutes) => set({ dailyGoalMinutes }),
  reset: () => set(initial),
}));
