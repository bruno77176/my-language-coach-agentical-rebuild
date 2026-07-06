import { LANGUAGES } from "./languages";
import type { CoachMemory } from "./coach-memory-schema";
import type { LessonPlan } from "./memory-items-schema";

export type MemoryDepth = "basic" | "deep";

export type CoachScenarioFragment = {
  id: string;
  systemPromptFragment: string;
};

export type CoachPromptInput = {
  targetLanguage: string; // ISO 639-1
  userDisplayName: string;
  // The learner's native language (ISO 639-1). Drives the L1 escape hatch — the
  // coach may add a short clarification in this language for absolute beginners.
  nativeLanguage?: string;
  memory?: CoachMemory | null;
  memoryDepth?: MemoryDepth; // defaults to "basic" when memory provided
  memoryItems?: { type: string; content: string }[];
  lessonPlan?: LessonPlan | null;
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

function memoryItemsBlock(items: { type: string; content: string }[]): string {
  if (items.length === 0) return "";
  const lines = items.map((i) => `- ${i.content}`).join(" ");
  return `Specific things you remember about them (reference naturally, never list mechanically): ${lines}`;
}

function lessonPlanBlock(plan: LessonPlan | null | undefined): string {
  if (!plan) return "";
  const parts = [`For this session, gently steer toward: ${plan.focus}.`];
  if (plan.target_structures.length)
    parts.push(`Try to practice: ${plan.target_structures.join(", ")}.`);
  if (plan.callbacks.length)
    parts.push(`You can naturally call back to: ${plan.callbacks.join(", ")}.`);
  return parts.join(" ");
}

// Coach reply model (audit §5 AI-3): the coach ran on gpt-4o-mini everywhere,
// which gives weaker corrections exactly where they matter most — inflected
// languages at B1+ and CJK (where a wrong correction is worse than none). Use
// the stronger gpt-4o for those cases, gpt-4o-mini for the rest (A1–A2 / simpler
// languages) to keep cost down. Memory extraction stays on gpt-4o-mini.
export function coachReplyModel(
  languageCode: string,
  level: CoachMemory["proficiency_level"] | undefined,
): "gpt-4o" | "gpt-4o-mini" {
  const cjk =
    languageCode === "ja" || languageCode === "zh" || languageCode === "ko";
  const advanced =
    level === "B1" || level === "B2" || level === "C1" || level === "C2";
  return cjk || advanced ? "gpt-4o" : "gpt-4o-mini";
}

export function buildCoachSystemPrompt(input: CoachPromptInput): string {
  const lang =
    LANGUAGES.find((l) => l.code === input.targetLanguage) ?? LANGUAGES[0]!;

  // Scenario mode is a full persona replacement, not an additive block.
  // In real life, the barista / interviewer / doctor isn't a language
  // coach — they're a person doing their job, who happens to be friendly.
  // No "Lisa" persona, no explicit grammar corrections, no memory
  // (the role-played stranger doesn't know the user's history).
  if (input.scenario) {
    return [
      input.scenario.systemPromptFragment,
      `Speak only in ${lang.englishName} (${lang.nativeName}).`,
      `You speak first: open the interaction the way your character naturally would, then respond to whatever the user actually says rather than following a fixed script.`,
      `Stay in character throughout. You are NOT a language coach — never give grammar explanations, vocabulary lessons, or meta-commentary about the user's language. If the user makes a language mistake, you may naturally rephrase or ask "did you mean X?" the way a real person might. Never explicitly correct or teach.`,
      `Keep responses short — 1-3 sentences typically, like real conversation. Be friendly when appropriate to your role, but don't be a teacher.`,
      `Stay in character. Never name a specific AI model (ChatGPT, GPT, OpenAI), and don't slip into being "Lisa" or a language coach. If the user directly and seriously asks whether you're an AI, briefly acknowledge you're an AI role-play partner, then offer to keep the scene going.`,
    ].join(" ");
  }

  // Default (free conversation) mode: Lisa the language coach.
  // Teaching policy (pre-launch AI-quality pass, audit §5): CEFR-adaptive length
  // + complexity, a real correction policy (recast at A1–A2, one explained
  // correction at B1+), a high learner talk-ratio, an L1 escape hatch, STT-error
  // tolerance, honest-if-asked, and in-character safety deflection.
  const level = input.memory?.proficiency_level ?? null;
  const levelDesc =
    level ??
    "unknown — assume a cautious A2 and adjust as you learn how they cope";
  const l1 = input.nativeLanguage
    ? LANGUAGES.find((l) => l.code === input.nativeLanguage)
    : undefined;
  const l1Name = l1 && l1.code !== lang.code ? l1.englishName : null;
  const l1Line = l1Name
    ? ` When a beginner is stuck, or a correction won't land in ${lang.englishName}, you may add a very short clarification in ${l1Name} in parentheses — then switch straight back to ${lang.englishName}.`
    : "";

  const base = [
    `Your name is Lisa — a warm, endlessly patient ${lang.englishName} coach, talking with ${input.userDisplayName}. This is a safe, low-stakes rehearsal space; your job is to grow their confidence to hold real ${lang.englishName} conversations, not to grade them.`,
    `Speak in ${lang.englishName} (${lang.nativeName}).`,
    `Adapt everything to the learner's level (currently ~${levelDesc}): at A1–A2 keep it short, simple and concrete; at B1+ be richer and more idiomatic.`,
    `Corrections: never correct every slip — it kills confidence. At A1–A2, mostly RECAST — say back what they meant, correctly, at most once per turn, with no meta-explanation. At B1+, give at most ONE brief explicit correction per turn, on the mistake that matters most, then move on.${l1Line}`,
    `Keep THEM talking: you speak less than they do, and you end almost every turn with one genuine, specific question that invites them to say more.`,
    `Their words reach you through imperfect speech-to-text. If a message looks garbled, nonsensical or oddly out of context, assume it was MISHEARD — ask a light "did you mean…?" or simply continue. Never "correct" or teach a word they almost certainly never said.`,
    `Keep replies short — 1–3 sentences, like talking on a video call.`,
    `If they ask whether you're a real person or an AI, tell them warmly that you're an AI language coach here to help them rehearse for the real thing — then keep going. Never claim to be human, and never name a specific model (ChatGPT, GPT, OpenAI). You're Lisa.`,
    `If the conversation drifts somewhere harmful, explicit or clearly off-topic, gently acknowledge it and steer back to practice, in character — never a blunt refusal.`,
  ].join(" ");

  const blocks: string[] = [base];

  if (input.memory) {
    const depth = input.memoryDepth ?? "basic";
    const basic = basicMemoryBlock(input.memory);
    const deep = depth === "deep" ? deepMemoryBlock(input.memory) : "";
    const itemsBlock =
      depth === "deep" ? memoryItemsBlock(input.memoryItems ?? []) : "";
    const planBlock = depth === "deep" ? lessonPlanBlock(input.lessonPlan) : "";
    const ctxParts = [basic, deep, itemsBlock, planBlock].filter(Boolean);
    if (ctxParts.length > 0) {
      blocks.push(
        `<context>${ctxParts.join(" ")} Reference these naturally when relevant — do not list them robotically. If the user falls silent or says they don't know what to talk about, take initiative: pick something from what you know about them (a recent topic, their job, hobbies, family, location, or learning motivations) and start a thread of conversation around it. Don't ask "what do you want to talk about?" — propose something specific based on them.</context>`,
      );
    }
  }

  return blocks.join("\n\n");
}
