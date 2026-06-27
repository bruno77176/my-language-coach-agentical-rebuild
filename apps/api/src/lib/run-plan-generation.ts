import { eq, and } from "drizzle-orm";
import type OpenAI from "openai";
import type { Database } from "../db";
import { coachMemory } from "../db/schema";
import { selectMemoryForPrompt } from "./select-memory";
import { generateLessonPlan } from "./generate-lesson-plan";
import type { OnUsage } from "../providers/usage";

/**
 * After a digest run, generate a next-lesson plan from the user's top memory
 * items and persist it to coach_memory.nextPlan.
 *
 * Returns immediately (void) in all early-exit cases so callers can wrap this
 * in a best-effort try/catch without worrying about partial state.
 */
export async function runPlanGeneration(
  db: Database,
  openai: OpenAI,
  input: { userId: string; languageCode: string },
  onUsage?: OnUsage,
): Promise<void> {
  const { userId, languageCode } = input;

  // Step 1: read proficiency level from the existing coach_memory row.
  const memRow = await db.query.coachMemory.findFirst({
    where: (t, { eq: e, and: a }) =>
      a(e(t.userId, userId), e(t.languageCode, languageCode)),
  });
  const proficiencyLevel = memRow?.proficiencyLevel ?? null;

  // Step 2: fetch top memory items to base the plan on.
  const items = await selectMemoryForPrompt(db, {
    userId,
    languageCode,
    limit: 12,
  });

  // Step 3: nothing to plan from — skip.
  if (items.length === 0) return;

  // Step 4: generate the plan via LLM; null means the LLM call failed or
  //         returned unparseable output — skip (generateLessonPlan already
  //         calls reportError internally).
  const plan = await generateLessonPlan(openai, {
    items,
    proficiencyLevel,
    languageCode,
    onUsage,
  });
  if (!plan) return;

  // Step 5: persist — a no-row update is harmless (row was created by the
  //         extractMemory upsert that runs before the digest).
  await db
    .update(coachMemory)
    .set({ nextPlan: plan, nextPlanGeneratedAt: new Date() })
    .where(
      and(
        eq(coachMemory.userId, userId),
        eq(coachMemory.languageCode, languageCode),
      ),
    );
}
