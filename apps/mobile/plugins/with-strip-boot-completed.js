// Config plugin loaded as CommonJS — `@expo/config` evaluates this via Node's
// classic require, so ESM syntax / TS would not load. Disable the
// no-require-imports rule for this file only.
/* eslint-disable @typescript-eslint/no-require-imports */
const { withAndroidManifest } = require("expo/config-plugins");

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
 *
 * Note: kept as .js (not .ts) because @expo/config evaluates app.config.ts
 * via a transformer that doesn't extend to nested requires — a .ts plugin
 * import here breaks `npx expo config` and therefore EAS builds.
 */
const withStripBootCompleted = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const application = manifest.application && manifest.application[0];
    if (!application) return cfg;

    const attrs = manifest.$;
    if (attrs && !attrs["xmlns:tools"]) {
      attrs["xmlns:tools"] = "http://schemas.android.com/tools";
    }

    const receivers = application.receiver || [];
    for (const receiver of receivers) {
      const filters = receiver["intent-filter"] || [];
      const remaining = filters.filter((f) => {
        const actions = f.action || [];
        return !actions.some(
          (a) =>
            a.$ &&
            a.$["android:name"] === "android.intent.action.BOOT_COMPLETED",
        );
      });
      if (remaining.length === filters.length) continue;
      if (remaining.length === 0) {
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

module.exports = withStripBootCompleted;
module.exports.default = withStripBootCompleted;
