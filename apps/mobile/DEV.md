# Mobile dev workflow

How to develop the Expo app on Bruno's Android device when iterating on JS code.

## One-time setup

1. Install the EAS dev client APK on the phone (already done — see Plan 3 Task 14).
2. Enable USB debugging on the phone (Settings → Developer options → USB debugging ON).
3. Plug the phone into the laptop with a **data-capable** USB cable (the cable that came with the phone is fine).
4. When the phone shows "Allow USB debugging from this computer?", tap **Allow** + tick "Always allow from this computer".

## Every time you start a dev session

### 1. Start Metro

Open a new PowerShell window:

```powershell
cd "C:\Users\bruno.moise\My Language Coach - rebuild\app\apps\mobile"
pnpm start
```

(Add `--clear` if anything is acting weird and you suspect cache issues: `pnpm start --clear`. Slower first bundle but resets Metro's transform cache.)

Metro prints colorful output and stays running. **JS console.log/error/warn from the phone shows up in this window with `LOG`/`ERROR` prefixes** — this is your primary debugging surface.

### 2. Set up ADB reverse port forwarding

The corporate firewall blocks LAN connections to Metro on port 8081, and ngrok tunnel mode is also blocked. **Workaround: USB ADB reverse** — phone's `localhost:8081` tunnels through the USB cable to your laptop's `localhost:8081`.

In a separate PowerShell window (or any terminal):

```powershell
adb devices                          # confirm phone shows as `device` (not `unauthorized` / `offline`)
adb reverse tcp:8081 tcp:8081        # set up the forward
adb reverse --list                   # should show: UsbFfs tcp:8081 tcp:8081
```

If `adb devices` shows nothing:

- Pull down the notification shade on the phone, tap the "USB controlled by..." notification, set USB mode to **"File transfer / Android Auto"** (not "Charging only"). Windows then re-enumerates and the phone appears.
- If the prompt to allow USB debugging didn't appear, revoke previous authorizations on the phone (Developer options → Revoke USB debugging authorizations) then unplug + replug.

If `adb devices` shows `unauthorized`, the "Allow USB debugging?" prompt is on the phone — tap Allow.

### 3. Open the dev client + connect to Metro

On the phone:

1. Open the **"My Language Coach (Development)"** app (the EAS dev client APK).
2. Tap the URL field, type **`http://localhost:8081`** (this resolves to the laptop via ADB reverse).
3. Tap **Connect**.

The app downloads the JS bundle (~10-30s on first connect, faster on subsequent reloads) and renders.

## In-session controls

### Reload the app after code changes

Most JS edits hot-reload automatically (Fast Refresh). When that fails or for native config changes:

- **Phone**: shake the device → dev menu pops up → tap "Reload".
- **Metro window**: press `r` to reload the connected device.

### Open the React DevTools / debug menu

- **Phone**: shake or in Metro press `j` to open the debugger (opens in Chrome).
- **Phone**: shake → "Show Element Inspector" to inspect rendered components.

### See what dev mode the app is in

The dev client header shows: dev mode | refresh | inspector toggles.

## Common gotchas

- **Logs aren't appearing in Metro** — the dev client connected to a different Metro instance (e.g. an old one). Kill all `node` processes (`Get-Process node | Stop-Process`), restart Metro, reload the app.
- **`adb reverse` "device not found"** — phone went to sleep / USB cable wiggled. Re-run after re-plugging.
- **App stuck on "Bundling..."** — check Metro window for a syntax error or missing module. Fix the source, save, Metro auto-rebuilds.
- **Magic-link email opens browser instead of app** — the link's `redirect_to` URL must be allowlisted in Supabase dashboard → Authentication → URL Configuration → Redirect URLs. We have `mylanguagecoach://**` registered.
- **NativeWind className not styling anything** — currently being debugged. Inline `style={{...}}` always works as a fallback.
- **`TurboModuleRegistry.getEnforcing(...): 'RNSomething' could not be found`** — pnpm workspace symlink gone missing. After `npx expo install <native-package>`, the package lands in workspace-root `node_modules/` but pnpm sometimes doesn't symlink it into `apps/mobile/node_modules/`, so React Native autolinking misses it on the next EAS build. Fix: from `app/` (workspace root), run `pnpm install`. Check the result with `ls apps/mobile/node_modules | grep <package>` — a symlink should be there. Then rebuild the dev client. The TS/Node processes locking files during `pnpm install` (EPERM errors on Windows) can be released without closing VSCode by `Ctrl+Shift+P` → "TypeScript: Restart TS Server".

## After installing a new native module

After `npx expo install <native-package>`, do this **before** triggering `eas build` to make sure the package is visible to autolinking:

```powershell
cd "C:\Users\bruno.moise\My Language Coach - rebuild\app"
pnpm install
ls apps/mobile/node_modules | Select-String <package-name>   # should print a row
```

If the symlink is missing despite `pnpm install`, see the gotcha above. As a future hardening: switching to `node-linker=hoisted` in `.npmrc` removes the per-app symlink layer entirely (flat npm-style `node_modules`), at the cost of pnpm's isolation. Don't do this lightly — it changes how every workspace package resolves deps and requires nuking + reinstalling all `node_modules`.

## When to rebuild the dev client (vs. just hot-reloading JS)

Most changes are JS-only and hot-reload. **Rebuild required** when you:

- Add/remove a native module (anything `expo install some-native-package`)
- Change `app.config.ts` plugins or entitlements
- Change Android `package` or iOS `bundleIdentifier`
- Change anything in `apps/mobile/Dockerfile` or `eas.json` build profile

Rebuild command (15-20 min via EAS Build):

```powershell
cd "C:\Users\bruno.moise\My Language Coach - rebuild\app\apps\mobile"
eas build --profile development --platform android --non-interactive
```

You get a fresh APK URL → install on the phone (replaces the old dev client).

## When the dev client crashes hard

- **App freezes / white screen for >30s on launch**: shake device → Developer Menu → "Reload" or "Settings → Reset". If still bad, close the app from the Android task switcher and reopen.
- **"Failed to connect to Metro"**: Metro isn't running, ADB reverse isn't active, or the URL is wrong. Run through steps 1-3 again.
