import { Platform } from "react-native";
import Constants from "expo-constants";
import mobileAds, {
  AdEventType,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from "react-native-google-mobile-ads";

/**
 * Resolve the rewarded ad-unit id for this platform. A real unit id (set via
 * app.config `extra`) is used in production builds; otherwise we fall back to
 * Google's official TEST unit, which is always safe to ship and serves test
 * ads in dev / before real ids are configured.
 */
function rewardedUnitId(): string {
  const extra = Constants.expoConfig?.extra ?? {};
  const real =
    Platform.OS === "ios"
      ? (extra.ADMOB_REWARDED_IOS as string | undefined)
      : (extra.ADMOB_REWARDED_ANDROID as string | undefined);
  if (real && !__DEV__) return real;
  return TestIds.REWARDED;
}

let initPromise: Promise<unknown> | null = null;
function ensureInitialized(): Promise<unknown> {
  // initialize() is safe to await repeatedly, but we memoize so concurrent
  // taps don't kick off multiple SDK inits.
  if (!initPromise) initPromise = mobileAds().initialize();
  return initPromise;
}

/**
 * Load and show a single rewarded ad.
 *
 * Resolves `true` ONLY if the user watched long enough to earn the reward;
 * resolves `false` if the ad failed to load/show or was dismissed early. The
 * caller should grant the reward (the +3 min) only on `true`. Never rejects —
 * a failed ad just means "no reward", and the user can try again.
 */
export async function showRewardedAd(): Promise<boolean> {
  try {
    await ensureInitialized();
  } catch {
    return false;
  }

  const ad = RewardedAd.createForAdRequest(rewardedUnitId(), {
    requestNonPersonalizedAdsOnly: true,
  });

  return new Promise<boolean>((resolve) => {
    let earned = false;
    let settled = false;
    const unsubscribers: Array<() => void> = [];
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      for (const off of unsubscribers) {
        try {
          off();
        } catch {
          // ignore
        }
      }
      resolve(result);
    };

    unsubscribers.push(
      ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        ad.show().catch(() => finish(false));
      }),
      ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      }),
      // CLOSED fires whether or not the reward was earned — resolve on the
      // accumulated `earned` flag so dismissing early grants nothing.
      ad.addAdEventListener(AdEventType.CLOSED, () => finish(earned)),
      ad.addAdEventListener(AdEventType.ERROR, () => finish(false)),
    );

    // Safety net: if the ad never loads (no fill / network), don't hang the UI.
    timeout = setTimeout(() => finish(false), 30000);

    ad.load();
  });
}
