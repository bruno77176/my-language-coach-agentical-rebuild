// apps/mobile/src/features/practice/active-session-store.ts
import { create } from "zustand";

type ActiveSessionState = {
  // Set while a conversation is in flight on the Practice screen.
  // Null when no active session exists.
  conversationId: string | null;

  // When the user taps a non-Practice tab during an active session, the
  // tab-press listener writes the target tab name here. The Practice
  // screen watches this value and shows the confirm Alert. Cleared by
  // the Practice screen after the user makes a choice.
  pendingTabName: string | null;

  setConversationId: (id: string | null) => void;
  requestTabSwitch: (name: string) => void;
  clearPendingTabSwitch: () => void;
};

export const useActiveSession = create<ActiveSessionState>((set) => ({
  conversationId: null,
  pendingTabName: null,
  setConversationId: (id) => set({ conversationId: id }),
  requestTabSwitch: (name) => set({ pendingTabName: name }),
  clearPendingTabSwitch: () => set({ pendingTabName: null }),
}));
