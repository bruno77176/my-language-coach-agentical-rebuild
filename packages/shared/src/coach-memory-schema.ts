import { z } from "zod";

export const RecentTopicSchema = z.object({
  topic: z.string().min(1).max(80),
  last_practiced_at: z.string().datetime(),
});

export const PersonalContextSchema = z
  .object({
    hobbies: z.array(z.string()).max(20).optional(),
    job: z.string().max(120).optional(),
    family: z.string().max(240).optional(),
    location: z.string().max(120).optional(),
    motivations: z.array(z.string()).max(10).optional(),
  })
  .strict();

export const CoachMemorySchema = z
  .object({
    proficiency_level: z
      .enum(["A1", "A2", "B1", "B2", "C1", "C2"])
      .optional()
      .nullable(),
    recent_topics: z
      .array(RecentTopicSchema)
      .transform((arr) => arr.slice(-20)), // cap at 20 most recent
    weak_areas: z.array(z.string().min(1).max(80)).max(20),
    personal_context: PersonalContextSchema,
    last_session_summary: z.string().max(1000).optional().nullable(),
  })
  .strict();

export type CoachMemory = z.infer<typeof CoachMemorySchema>;
export type RecentTopic = z.infer<typeof RecentTopicSchema>;
export type PersonalContext = z.infer<typeof PersonalContextSchema>;

export function emptyCoachMemory(): CoachMemory {
  return {
    proficiency_level: null,
    recent_topics: [],
    weak_areas: [],
    personal_context: {},
    last_session_summary: null,
  };
}

/**
 * Defensive parser for a Drizzle `coach_memory` row. Maps snake_case JSONB
 * columns to the Zod-validated CoachMemory shape. Returns `null` if the row
 * fails validation (corrupt or out-of-date data) — caller degrades to "no
 * memory" rather than crashing or passing bad data to the prompt.
 *
 * Use this on the READ path in voice.ts /turns. The WRITE path validates via
 * extractMemory (which returns CoachMemorySchema-parsed output already).
 */
export function parseCoachMemoryRow(
  row:
    | {
        proficiencyLevel?: string | null;
        recentTopics?: unknown;
        weakAreas?: unknown;
        personalContext?: unknown;
        lastSessionSummary?: string | null;
      }
    | null
    | undefined,
): CoachMemory | null {
  if (!row) return null;
  const candidate = {
    proficiency_level: row.proficiencyLevel ?? null,
    recent_topics: row.recentTopics ?? [],
    weak_areas: row.weakAreas ?? [],
    personal_context: row.personalContext ?? {},
    last_session_summary: row.lastSessionSummary ?? null,
  };
  const result = CoachMemorySchema.safeParse(candidate);
  return result.success ? result.data : null;
}
