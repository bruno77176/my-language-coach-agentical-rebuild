import AsyncStorage from "@react-native-async-storage/async-storage";
import * as StoreReview from "expo-store-review";

const GOAL_HITS_KEY = "review-prompt.goal-hits";
const LAST_PROMPT_KEY = "review-prompt.last-at";
// Don't ask brand-new users (wait for a couple of goal hits) and never nag.
const MIN_GOAL_HITS = 2;
const MIN_DAYS_BETWEEN = 45;

/**
 * Ask for an in-app rating at a high point — right after the user hits their
 * daily goal (BRU-10). Throttled so it only ever fires after a couple of goal
 * hits and at most every ~45 days. The OS additionally rate-limits the real
 * dialog, so this is best-effort and silent on failure.
 */
export async function maybeRequestReviewOnGoal(): Promise<void> {
  try {
    const hits = (Number(await AsyncStorage.getItem(GOAL_HITS_KEY)) || 0) + 1;
    await AsyncStorage.setItem(GOAL_HITS_KEY, String(hits));
    if (hits < MIN_GOAL_HITS) return;

    const lastAt = Number(await AsyncStorage.getItem(LAST_PROMPT_KEY)) || 0;
    if (lastAt && (Date.now() - lastAt) / 86_400_000 < MIN_DAYS_BETWEEN) return;

    if (!(await StoreReview.isAvailableAsync())) return;
    await AsyncStorage.setItem(LAST_PROMPT_KEY, String(Date.now()));
    await StoreReview.requestReview();
  } catch {
    // best-effort — never block the celebration on a review prompt
  }
}
