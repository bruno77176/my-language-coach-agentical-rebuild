import { useEffect, useState, useCallback } from "react";
import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
} from "react-native-purchases";

/**
 * RevenueCat wrapper hook. Reads the current customer info + offerings on
 * mount and re-renders on entitlement changes (e.g. after a successful
 * purchase, RC fires `addCustomerInfoUpdateListener`).
 *
 * Pro detection keys off the `pro` entitlement defined in the RevenueCat
 * dashboard (Task 17). If the SDK isn't configured yet (e.g. running on
 * iOS while we're Android-only for v2, or the API key env var is missing),
 * the initial fetch will throw and we degrade silently — `isPro` stays
 * false and `offerings` stays null. The UI must handle a null offerings
 * shape (Step 5 paywall already does).
 */
export function usePurchases() {
  const [info, setInfo] = useState<CustomerInfo | null>(null);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const ci = await Purchases.getCustomerInfo();
        if (!cancelled) setInfo(ci);
        const offs = await Purchases.getOfferings();
        if (!cancelled) setOfferings(offs.current);
      } catch {
        // SDK not configured; user can still browse free features
      }
    })();
    const listener = (ci: CustomerInfo) => setInfo(ci);
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      cancelled = true;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, []);

  const isPro = !!info?.entitlements.active.pro;

  const purchase = useCallback(
    async (packageId: "monthly" | "annual") => {
      if (!offerings) throw new Error("no_offerings");
      const pkg =
        packageId === "monthly" ? offerings.monthly : offerings.annual;
      if (!pkg) throw new Error("package_not_found");
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      setInfo(customerInfo);
    },
    [offerings],
  );

  const restore = useCallback(async () => {
    const ci = await Purchases.restorePurchases();
    setInfo(ci);
  }, []);

  return { isPro, offerings, purchase, restore };
}
