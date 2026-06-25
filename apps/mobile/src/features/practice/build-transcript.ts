import { LANGUAGES } from "@language-coach/shared";
import { inviteLink } from "../sharing/share-text";

export type TranscriptMessage = {
  role: "user" | "coach";
  text: string;
};

export type TranscriptInput = {
  languageCode: string;
  startedAt: Date;
  durationMinutes: number;
  messages: TranscriptMessage[];
};

export function buildTranscript(input: TranscriptInput): string {
  const lang = LANGUAGES.find((l) => l.code === input.languageCode);
  const langName = lang?.englishName ?? input.languageCode;
  const dateStr = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(input.startedAt);

  const lines: string[] = [
    `My Language Coach — ${langName} practice`,
    `${dateStr} · ${input.durationMinutes} min`,
    "",
  ];
  for (const m of input.messages) {
    lines.push(`${m.role === "user" ? "You" : "Coach"}: ${m.text}`);
  }
  return lines.join("\n") + "\n" + inviteLink();
}
