// apps/mobile/src/features/practice/active-session-store.ts
import { create } from "zustand";

export type ActiveStartParams = {
  scenarioId?: string;
  start?: string;
};

type ActiveSessionState = {
  // Set while a conversation is in flight on the Practice screen.
  // Null when no active session exists.
  conversationId: string | null;

  // URL params (scenarioId / start) for the active conversation, captured
  // when ActiveConversation mounts. Used by the Practice tab interceptor
  // to restore the conversation URL when the user navigates back to the
  // Practice tab after a "Just leave" — router.push to a sibling tab wipes
  // the Practice tab's URL params, so without this we'd render the chooser.
  activeStartParams: ActiveStartParams | null;

  // When the user taps a non-Practice tab during an active session, the
  // tab-press listener writes the target tab name here. The Practice
  // screen watches this value and shows the confirm Alert. Cleared by
  // the Practice screen after the user makes a choice.
  pendingTabName: string | null;

  // Tracks which tab the user is currently on. Set by a useFocusEffect on
  // Practice (the only tab we care about distinguishing). Used by the tab
  // interceptors to scope the popup: it should only fire when leaving the
  // Practice screen, not between unrelated tabs like Progress -> Profile.
  currentTab: "practice" | null;

  setActive: (id: string, params: ActiveStartParams) => void;
  clearActive: () => void;
  setCurrentTab: (tab: "practice" | null) => void;
  requestTabSwitch: (name: string) => void;
  clearPendingTabSwitch: () => void;
};

export const useActiveSession = create<ActiveSessionState>((set) => ({
  conversationId: null,
  activeStartParams: null,
  pendingTabName: null,
  currentTab: null,
  setActive: (id, params) =>
    set({ conversationId: id, activeStartParams: params }),
  clearActive: () => set({ conversationId: null, activeStartParams: null }),
  setCurrentTab: (tab) => set({ currentTab: tab }),
  requestTabSwitch: (name) => set({ pendingTabName: name }),
  clearPendingTabSwitch: () => set({ pendingTabName: null }),
}));
