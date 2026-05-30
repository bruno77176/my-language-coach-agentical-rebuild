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
