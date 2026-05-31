import { withAndroidManifest, type ConfigPlugin } from "expo/config-plugins";

/**
 * Strip BOOT_COMPLETED intent-filters from every <receiver> in the merged
 * Android manifest.
 *
 * Why: Android 15+ forbids BOOT_COMPLETED receivers from launching
 * foreground services with restricted types (microphone, mediaPlayback,
 * camera, etc.). One of expo-audio's transitive dependencies (the media3
 * MediaSession library) registers such a receiver and the merged manifest
 * picks it up. Google Play Console flags this as
 * "Types de services de premier plan restreints" / "Restricted foreground
 * service types" with a crash warning for Android 15 users.
 *
 * We never need audio on boot — our app only plays / records during active
 * practice sessions — so removing the receiver is safe.
 *
 * Implementation: walk the merged manifest, find every receiver whose
 * intent-filter list contains an action of BOOT_COMPLETED, and either
 * remove just that filter (when the receiver has multiple) or mark the
 * receiver itself for removal via `tools:node="remove"`.
 */
const withStripBootCompleted: ConfigPlugin = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const application = manifest.application?.[0];
    if (!application) return cfg;

    // Ensure the tools namespace is available so tools:node attributes resolve.
    const attrs = (manifest as unknown as { $?: Record<string, string> }).$;
    if (attrs && !attrs["xmlns:tools"]) {
      attrs["xmlns:tools"] = "http://schemas.android.com/tools";
    }

    const receivers = application.receiver ?? [];
    for (const receiver of receivers) {
      const filters = receiver["intent-filter"] ?? [];
      const remaining = filters.filter((f) => {
        const actions = f.action ?? [];
        const hasBoot = actions.some(
          (a) =>
            a.$?.["android:name"] === "android.intent.action.BOOT_COMPLETED",
        );
        return !hasBoot;
      });
      if (remaining.length === filters.length) continue; // nothing to strip
      if (remaining.length === 0) {
        // Receiver only existed to handle BOOT_COMPLETED — remove it entirely.
        receiver.$ = {
          ...receiver.$,
          "tools:node": "remove",
        };
        receiver["intent-filter"] = [];
      } else {
        receiver["intent-filter"] = remaining;
      }
    }
    return cfg;
  });

export default withStripBootCompleted;
