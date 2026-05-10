export type ChatMessage = {
  id: string;
  role: "user" | "coach";
  text: string;
  audioUrl?: string | null;
  audioDurationMs?: number;
  isGreeting?: boolean;
};

export type ConversationState =
  | { phase: "loading-session" }
  | { phase: "idle" | "recording" | "processing"; conversationId: string }
  | { phase: "error"; message: string };
