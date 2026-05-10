export type ChatMessage = {
  id: string;
  role: "user" | "coach";
  text: string;
  audioUrl?: string | null;
  audioDurationMs?: number;
  isGreeting?: boolean;
  /**
   * Pre-computed translation in the user's native language. Set client-side
   * for messages where translation is templated (e.g. greetings) so the
   * translate icon doesn't need to call the backend API.
   */
  clientTranslation?: string;
};

export type ConversationState =
  | { phase: "loading-session" }
  | { phase: "idle" | "recording" | "processing"; conversationId: string }
  | { phase: "error"; message: string };
