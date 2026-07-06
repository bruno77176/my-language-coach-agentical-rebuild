import type { CoachMemory } from "./coach-memory-schema";

/** CEFR proficiency level (A1–C2). Reuses the coach-memory enum. */
export type ProficiencyLevel = NonNullable<CoachMemory["proficiency_level"]>;

/**
 * Self-assessment options for onboarding + the profile level editor. Friendly
 * plain-language buckets, each mapped to a CEFR code (shown alongside the label
 * so users see both). The coach's teaching policy branches on A1–A2 vs B1+, and
 * coachReplyModel() upgrades to gpt-4o at B1+, so the CEFR code is what actually
 * drives behavior — the label is just the human-friendly framing.
 */
export const PROFICIENCY_LEVELS: ReadonlyArray<{
  code: ProficiencyLevel;
  label: string;
  blurb: string;
}> = [
  { code: "A1", label: "Just starting out", blurb: "A few words and phrases" },
  {
    code: "A2",
    label: "I know the basics",
    blurb: "Simple everyday exchanges",
  },
  {
    code: "B1",
    label: "I can hold a conversation",
    blurb: "Familiar topics, with some effort",
  },
  {
    code: "B2",
    label: "I'm quite comfortable",
    blurb: "Most topics, fairly fluently",
  },
  { code: "C1", label: "Advanced", blurb: "Fluent and spontaneous" },
  {
    code: "C2",
    label: "Fluent / near-native",
    blurb: "Effortless in almost everything",
  },
] as const;

const LEVEL_CODES = new Set<string>(PROFICIENCY_LEVELS.map((l) => l.code));

/** Narrow an arbitrary string to a ProficiencyLevel, or null if not a CEFR code. */
export function toProficiencyLevel(
  value: string | null | undefined,
): ProficiencyLevel | null {
  return value && LEVEL_CODES.has(value) ? (value as ProficiencyLevel) : null;
}
