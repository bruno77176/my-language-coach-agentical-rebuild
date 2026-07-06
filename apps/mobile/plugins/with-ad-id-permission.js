// Config plugin loaded as CommonJS — @expo/config evaluates app.config.ts via a
// transformer that doesn't extend to nested requires, so a .ts plugin breaks
// `npx expo config` / EAS builds (same reason as with-modular-headers.js).
/* eslint-disable @typescript-eslint/no-require-imports */
const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Force `com.google.android.gms.permission.AD_ID` into the MERGED manifest with
 * `tools:node="replace"`.
 *
 * Why: the app declares (on the Play Console) that it uses an advertising ID
 * (true — AdMob's rewarded ad), so the built manifest MUST contain the AD_ID
 * permission or Play blocks the release. Google's Play-services measurement/ads
 * SDK injects `<uses-permission … AD_ID tools:node="remove"/>`, which strips a
 * plain permission added via Expo's `android.permissions` — that's why builds
 * 94/95 kept failing the ad-ID check. `tools:node="replace"` on the app's own
 * (highest-priority) manifest is Google's documented override: it wins the merge
 * and keeps the permission. See Play Console → advertising ID.
 */
const AD_ID = "com.google.android.gms.permission.AD_ID";

module.exports = function withAdIdPermission(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    // Declare the `tools` namespace on <manifest> so tools:node resolves.
    manifest.$ = manifest.$ || {};
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    // Replace any existing AD_ID entry with our node="replace" one (dedup).
    const perms = manifest["uses-permission"] || [];
    const kept = perms.filter(
      (p) => !p || !p.$ || p.$["android:name"] !== AD_ID,
    );
    kept.push({ $: { "android:name": AD_ID, "tools:node": "replace" } });
    manifest["uses-permission"] = kept;
    return cfg;
  });
};
