// Shared usage-report types used by every paid provider.
//
// Each provider call invokes `onUsage` exactly once with a report describing
// the unit count(s) consumed. `app.ts` bridges these reports into
// `recordUsage(db, ...)` via fire-and-forget.

export type UsageReport = {
  provider: "openai" | "deepgram" | "elevenlabs";
  operation: string; // e.g. "chat:gpt-4o-mini", "transcribe:nova-3", "tts:tts-1"
  inputTokens?: number;
  outputTokens?: number;
  characters?: number;
  seconds?: number;
};

export type OnUsage = (report: UsageReport) => Promise<void> | void;
