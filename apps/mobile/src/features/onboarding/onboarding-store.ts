import { create } from "zustand";

type OnboardingState = {
  displayName: string;
  nativeLang: string;
  targetLang: string;
  // Self-declared CEFR level for targetLang ("" = "I'm not sure", left to the AI).
  selfDeclaredLevel: string;
  dailyGoalMinutes: number;
  setDisplayName: (v: string) => void;
  setNativeLang: (v: string) => void;
  setTargetLang: (v: string) => void;
  setSelfDeclaredLevel: (v: string) => void;
  setDailyGoalMinutes: (v: number) => void;
  reset: () => void;
};

const initial = {
  displayName: "",
  nativeLang: "",
  targetLang: "",
  selfDeclaredLevel: "",
  dailyGoalMinutes: 10,
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initial,
  setDisplayName: (displayName) => set({ displayName }),
  setNativeLang: (nativeLang) => set({ nativeLang }),
  setTargetLang: (targetLang) => set({ targetLang }),
  setSelfDeclaredLevel: (selfDeclaredLevel) => set({ selfDeclaredLevel }),
  setDailyGoalMinutes: (dailyGoalMinutes) => set({ dailyGoalMinutes }),
  reset: () => set(initial),
}));
