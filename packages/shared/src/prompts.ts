import { LANGUAGES } from "./languages";
import type { CoachMemory } from "./coach-memory-schema";

export type MemoryDepth = "basic" | "deep";

export type CoachScenarioFragment = {
  id: string;
  systemPromptFragment: string;
};

export type CoachPromptInput = {
  targetLanguage: string; // ISO 639-1
  userDisplayName: string;
  memory?: CoachMemory | null;
  memoryDepth?: MemoryDepth; // defaults to "basic" when memory provided
  scenario?: CoachScenarioFragment | null;
};

function basicMemoryBlock(memory: CoachMemory): string {
  const parts: string[] = [];
  if (memory.proficiency_level) {
    parts.push(`Approximate level: ${memory.proficiency_level}.`);
  }
  if (memory.recent_topics.length > 0) {
    const recent = memory.recent_topics
      .slice(-5)
      .map((t) => t.topic)
      .join(", ");
    parts.push(`Recent topics you've discussed together: ${recent}.`);
  }
  if (memory.last_session_summary) {
    parts.push(`Last session: ${memory.last_session_summary}`);
  }
  return parts.join(" ");
}

function deepMemoryBlock(memory: CoachMemory): string {
  const parts: string[] = [];
  if (memory.weak_areas.length > 0) {
    parts.push(
      `Known weak areas to gently revisit: ${memory.weak_areas.join(", ")}.`,
    );
  }
  const ctx = memory.personal_context;
  const personal: string[] = [];
  if (ctx.job) personal.push(`works as ${ctx.job}`);
  if (ctx.hobbies?.length)
    personal.push(`hobbies include ${ctx.hobbies.join(", ")}`);
  if (ctx.family) personal.push(`family: ${ctx.family}`);
  if (ctx.location) personal.push(`based in ${ctx.location}`);
  if (ctx.motivations?.length)
    personal.push(`learning to ${ctx.motivations.join(", ")}`);
  if (personal.length > 0) {
    parts.push(`The student ${personal.join("; ")}.`);
  }
  return parts.join(" ");
}

export function buildCoachSystemPrompt(input: CoachPromptInput): string {
  const lang =
    LANGUAGES.find((l) => l.code === input.targetLanguage) ?? LANGUAGES[0]!;
  const base = [
    `Your name is Lisa. You are a kind, patient ${lang.englishName} language coach.`,
    `You are talking to ${input.userDisplayName}.`,
    `Speak only in ${lang.englishName} (${lang.nativeName}).`,
    `When the user makes a grammar or vocabulary mistake, gently correct them with a brief explanation, then continue the conversation naturally.`,
    `Keep responses short — 1-3 sentences typically — as if speaking on a video call.`,
    `Never break character. Never switch to English unless the user explicitly asks for help.`,
    `Never mention being ChatGPT, GPT, OpenAI, or any specific AI model — if asked, you are simply Lisa, a friendly language coach.`,
  ].join(" ");

  const blocks: string[] = [base];

  if (input.memory) {
    const depth = input.memoryDepth ?? "basic";
    const basic = basicMemoryBlock(input.memory);
    const deep = depth === "deep" ? deepMemoryBlock(input.memory) : "";
    const ctxParts = [basic, deep].filter(Boolean);
    if (ctxParts.length > 0) {
      blocks.push(
        `<context>${ctxParts.join(" ")} Reference these naturally when relevant — do not list them robotically.</context>`,
      );
    }
  }

  if (input.scenario) {
    blocks.push(`<scenario>${input.scenario.systemPromptFragment}</scenario>`);
  }

  return blocks.join("\n\n");
}
