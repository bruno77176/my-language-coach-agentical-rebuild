import { z } from "zod";

export const MemoryItemTypeSchema = z.enum([
  "fact",
  "mistake",
  "preference",
  "goal",
  "persona_detail",
]);
export type MemoryItemType = z.infer<typeof MemoryItemTypeSchema>;

export const MemoryItemCandidateSchema = z.object({
  type: MemoryItemTypeSchema,
  content: z.string().min(1).max(500),
  // Optional spaced-repetition seed for mistakes/vocab (used in L1b/L2).
  sr_seed: z.boolean().optional(),
});
export type MemoryItemCandidate = z.infer<typeof MemoryItemCandidateSchema>;

export const MemoryItemCandidateListSchema = z
  .array(MemoryItemCandidateSchema)
  .max(20);

export const LessonPlanSchema = z.object({
  focus: z.string().min(1),
  target_structures: z.array(z.string()).default([]),
  suggested_topics: z.array(z.string()).default([]),
  callbacks: z.array(z.string()).default([]),
});
export type LessonPlan = z.infer<typeof LessonPlanSchema>;
