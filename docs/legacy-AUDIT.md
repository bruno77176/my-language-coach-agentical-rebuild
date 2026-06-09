# My Language Coach — Full Audit

**Date:** 2026-05-09
**Scope:** `my-language-coach/` (Expo React Native app, SDK 52, JavaScript) and `my-language-coach-backend/` (Node/Express + Mongoose, deployed on Render).
**Reviewer:** Claude Code

This document audits the current state of the app and backend before a planned rewrite. Findings are grouped by severity and end with a tech-stack critique against 2026 standards and a proposed rebuild stack.

**Rebuild assumption:** the user has confirmed nothing from the legacy stack will be reused. No data migration, no infra reuse, no account reuse required. The audit is therefore archival — it documents what went wrong so the rebuild doesn't repeat it.

---

## Table of contents

1. [Operational status (May 2026)](#operational-status-may-2026)
2. [Critical issues](#critical-issues)
3. [Important issues](#important-issues)
4. [Code smells & quality](#code-smells--quality)
5. [Tech-choice critique (2026 lens)](#tech-choice-critique-2026-lens)
6. [Testing](#testing)
7. [Recommended rebuild stack](#recommended-rebuild-stack)
8. [Account & service inventory](#account--service-inventory)

---

## Operational status (May 2026)

The legacy app is dormant in production. Confirmed via dashboards on 2026-05-09:

- **MongoDB Atlas — `Cluster0`** in `Project 0` (`Bruno's Org`): **paused** for prolonged inactivity. Any user with the app installed who tries to sync gets a 500 from the backend until the cluster is resumed (and it will re-pause after the next idle period).
- **Render — `my-language-coach-backend`** (Service ID `srv-d0chopadbo4c73ffofc0`, GitHub `bruno77176/my-language-coach-backend`, branch `main`): **free tier, cold**. Render banner: _"Your free instance will spin down with inactivity, which can delay requests by 50 seconds or more"_. Zero events in the past 90 days — no traffic, no deploys.
- **Google Play Console — `com.anonymous.mylanguagecoach`**: production status **Inactif (inactive)**. Console banner: _"Compte de développeur risquant d'être clôturé pour inactivité"_ — developer account at risk of closure for inactivity, action required **by 4 July 2026**. A separate notice flags new Android developer-validation requirements that need explicit re-acceptance.
- **Google Cloud — project `language-coach-app`** (project number `446154042539`): hosts the Google TTS API key.
- **Expo — account `bruno77176`, project `my-language-coach`**: last 3 iOS App Store submissions are 11 months old (1.0.0 failed, 1.0.1 + 1.0.2 succeeded). No active development or production builds registered. EAS Submissions used at least once, EAS Update never used.

### What this means for the audit

- **C2 (financial DoS) is dormant in current state.** With the backend cold and the database paused, an attacker hitting the live URL today still triggers OpenAI calls (chargeable!) but no DB writes succeed. The hot risk that remains is the **OpenAI API key + Google TTS API key sitting in Render's environment** — anyone who learned the URL during the period the app was active can still drain credits via `/api/chat`, `/api/tts`, etc. **Action: rotate or remove these two keys in the Render env tab today**, even if you're not touching the rebuild for weeks.
- **MongoDB cluster being paused is an availability bug for any user who still has the app installed.** It won't auto-resume on demand — Atlas requires an explicit console click. If even one user is still on the app, they're broken right now.
- **Play Console deadline (4 July 2026) is the only hard external date.** Options: (a) abandon the existing developer account, build the rebuild under a fresh account; (b) keep the account alive by uploading any internal-track build before the deadline. Decide before mid-June so option (b) is still feasible.
- **No data to preserve.** Greenfield rebuild is approved, so all sequencing in [§Recommended rebuild stack](#recommended-rebuild-stack) skips the migration steps.

Full dashboard inventory at the bottom: [§Account & service inventory](#account--service-inventory).

---

## Critical issues

These are production-breakers, security risks, or financial exposure. Fix or mitigate before anything else — even before the rebuild starts, since the backend is currently live.

### C1. Streak update is dead code — variable shadowing bug

**File:** `my-language-coach/components/ChatScreen.js:41-48` and `:101-125`

The component imports `updateStreak` from `services/api`:

```js
import { fetchUserData, updateStreak, transcribeAudio, ... } from "../services/api";
```

Then declares a local function with the same name:

```js
const updateStreak = async () => {
  ...
  if (lastPracticeDate !== today) {
    updatedStreak = lastPracticeDate === yesterday ? streakCount + 1 : 1;
    await updateStreak(deviceId, updatedStreak, today, today);  // ← calls itself
    setStreakCount(updatedStreak);
    setLastPracticeDate(today);
  }
  ...
};
```

The call inside the body resolves to the local arrow function, not the imported API function (the local `const` shadows the import for the entire function scope).

**Consequences:**

- The backend `PUT /api/user/streak` is **never called** from this code path. The `streakCount` field in MongoDB is never persisted.
- The recursive call passes 4 args to a function that takes none — args are silently dropped, no parameter-driven base case.
- Closure state (`lastPracticeDate`, `today`) doesn't change between recursive iterations → infinite recursion → `RangeError: Maximum call stack size exceeded`.
- The `await` never resolves, so subsequent `setShowConfetti(false)` and `setShowPopup(false)` timers in `useConversationTimer` never fire — confetti/popup may stay on screen indefinitely.

**Fix:** rename the import (`import { updateStreak as apiUpdateStreak }`) or rename the local function. Then add a unit test for the streak math so this never recurs.

---

### C2. Backend has no auth, no rate limiting, no origin restrictions — financial DoS

**File:** `my-language-coach-backend/index.js`

- `app.use(cors())` is wide open — any origin can call the backend.
- No API key, JWT, HMAC, or request signature on `/api/chat`, `/api/chat-history`, `/api/transcribe`, `/api/translate`, `/api/tts`. The base URL is hard-coded into the app bundle (`my-language-coach/services/api.js:7`) and is trivially extractable from a decompiled APK or a single mitmproxy session.
- No `express-rate-limit`, no per-IP throttle, no per-deviceId quota, no daily budget cap on OpenAI/Google calls.
- `app.use(express.json({ limit: "50mb" }))` is applied globally; only `/api/transcribe` legitimately needs that ceiling. Any endpoint will accept and parse a 50MB body.

**Consequences:** anyone who learns the backend URL can drain the OpenAI + Google TTS credits attached to it. There is no defense against a script that POSTs to `/api/chat` in a loop.

**Current status:** the backend is on a Render free instance that's been spun down for ~90 days, so this risk is dormant — but the OpenAI + Google TTS API keys still live in the Render env. Any actor who scraped the URL while the app was active can still hit it (Render cold-starts on first request).

**Immediate action regardless of rebuild timeline:** rotate (or delete) the `OPENAI_API_KEY` and `GOOGLE_TTS_API_KEY` in the Render env tab for `srv-d0chopadbo4c73ffofc0`. This takes 30 seconds and removes the only hot liability from the legacy stack.

**Check now:** review your OpenAI + Google Cloud usage dashboards for the past 12 months for unexpected spikes.

**Defense for the rebuild (not retroactive — the legacy backend won't get these):**

1. Lock CORS to a known origin list, not `*`.
2. `express-rate-limit` (or framework equivalent) per IP and per authenticated user.
3. HMAC-signed requests from the app, server-side validated, key rotated per release.
4. Per-route body limits — only the transcription endpoint needs >100KB.
5. Hard usage caps and budget alerts in OpenAI / Google Cloud dashboards.

---

### C3. iPhone audio bugs — root cause is the audio session

**Files:** `my-language-coach/components/ChatScreen.js:314-334`, `:496-558`, `:671-679`, `:696`

Two audio engines are competing for the iOS audio session:

- `expo-av` (`Audio.setAudioModeAsync`) is configured once on mount with `allowsRecordingIOS: false`.
- `react-native-audio-record` does **not** use the same session; it manages its own `AVAudioSession` internally. When `AudioRecord.start()` runs, the iOS session category is forced to `playAndRecord` or `record`. After `AudioRecord.stop()`, the session is left in record mode, and subsequent `expo-av` `playAsync()` either fails or plays silently because the previously-set `allowsRecordingIOS: false` is now stale.

The 200ms delay at `ChatScreen.js:696` (`if (Platform.OS === "ios") await new Promise(r => setTimeout(r, 200))`) is a band-aid — it gives iOS time to settle the session, but it's neither reliable nor a real fix.

`interruptionModeIOS: InterruptionModeIOS.DoNotMix` means a phone call permanently kills your audio session with no recovery path; the user has to kill the app.

**Fix (short-term):** before each recording, call `Audio.setAudioModeAsync({ allowsRecordingIOS: true, ... })`; after recording stops, call it again with `allowsRecordingIOS: false`. Listen for `interruption` events and re-issue `setAudioModeAsync` on resume.

**Fix (rebuild):** drop `react-native-audio-record` entirely. Use `expo-audio` (the SDK 54+ replacement for the deprecated `expo-av`) which manages a single session. Better still, switch to **OpenAI Realtime API over WebRTC** — see [§4 Voice loop](#voice-loop-architecture-is-two-generations-behind).

---

### C4. `temp_audio.m4a` is a fixed filename — race condition + cross-user data leak

**File:** `my-language-coach-backend/index.js:99-119`

```js
const tempFilePath = path.join(__dirname, "temp_audio.m4a");
fs.writeFileSync(tempFilePath, audioBuffer);
formData.append("file", fs.createReadStream(tempFilePath));
```

Every `/api/transcribe` request writes to the same path. Under concurrent load, request A's audio is overwritten by request B's audio before A's `axios.post` to Whisper has finished streaming the file. Result: A receives B's transcription. This is a privacy incident in addition to a correctness bug — user voice transcripts can leak across users.

**Fix:** stream the buffer directly into `form-data` without writing to disk, or use `os.tmpdir() + crypto.randomUUID()` per request and `fs.rm` in a `finally`.

---

### C5. `form-data` is a phantom dependency

**File:** `my-language-coach-backend/index.js:4` requires `form-data`, but `package.json` does not declare it. It currently resolves transitively via `axios`. The day axios changes its dependencies (or anyone runs `npm prune` / `npm ci` with a different lockfile) production crashes on startup with `Cannot find module 'form-data'`.

**Fix:** `npm install form-data` in `my-language-coach-backend/`.

---

### C6. `deviceId` as identity = identity spoofing

**Files:** `my-language-coach/utils/secureStorage.js:5-10`, `my-language-coach-backend/index.js:187-274`

The frontend generates `deviceId` as `SHA256(Date.now() + Math.random())` and the backend uses it as the only key into the User collection. There is no auth, no signature.

`GET /api/leaderboard` returns every user's `deviceId` in plaintext (`backend/index.js:264`):

```js
const users = await User.find(
  {},
  "userName streakCount minutesSpoken deviceId nativeLang targetLang",
);
```

So any client that calls the leaderboard endpoint walks away with a list of valid identity tokens. With a known `deviceId`, anyone can:

- `GET /api/user/:deviceId` — read the full profile.
- `POST /api/user` — overwrite the username, languages, and goal.
- `POST /api/user/logPractice` — inflate that user's minutes.

**Fix:**

1. Strip `deviceId` from the leaderboard response; expose only `userName`, `streakCount`, `minutesSpoken`.
2. Move to real auth (Sign in with Apple/Google, or magic-link email) in the rebuild. Migration: link each existing `deviceId` to a new account on first sign-in.

Note: `Crypto.digestStringAsync(SHA256, Date.now() + Math.random())` is also not cryptographically random (`Math.random()` is not CSPRNG). Use `expo-crypto`'s `randomUUID()` or `getRandomBytesAsync`. This isn't currently exploited — but the threat model where it would matter is exactly the leaderboard-spoofing scenario above.

---

### C7. `secondsSpoken` is client-trusted — leaderboard is gameable

**File:** `my-language-coach-backend/index.js:222-256`

`POST /api/user/logPractice` takes `secondsSpoken` from the request body with no plausibility check. A user (or anyone with a `deviceId`, see C6) can post `secondsSpoken: 99999999` and dominate the leaderboard.

**Fix:** server-side rate-limit minutes per deviceId per day; cap any single submission at e.g. 30 minutes; correlate with chat-completion calls during that window.

---

## Important issues

These are real bugs and design problems that surface in normal use, but won't immediately take you down.

### I1. The TTS cache is wiped by design

**Files:** `my-language-coach/hooks/cleanAudioFiles.js`, `my-language-coach/hooks/useCleanupAudioFiles.js`, `my-language-coach/components/ChatScreen.js:282`

`cleanupAudioFiles()` deletes **every** `.mp3` under `FileSystem.documentDirectory`. It runs:

- On every app launch (mounted in `App.js` via `useCleanupAudioFiles`).
- Every time the app goes to background (in `ChatScreen.js`'s `handleAppStateChange`).

But `utils/cache.js` writes the cached greeting audio to that same directory as `greeting-${languageCode}-${userName}.mp3`. Net effect:

- Cached greeting → deleted next launch → re-fetched from `/api/tts` → costs money + adds 1-2s latency on every cold open.
- User-recorded message audio (`${messageId}.mp3`) → deleted when app is backgrounded → "repeat my last sentence" feature breaks across app suspensions.

**Fix:** put user recordings under `${documentDirectory}recordings/` and cache audio under `${documentDirectory}cache/`. Only wipe `recordings/`.

---

### I2. Timezone bug in streak calculation

**File:** `my-language-coach/components/ChatScreen.js:102-105`

```js
const today = new Date().toISOString().split("T")[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
```

Both convert to **UTC** dates. A user in California practicing at 10pm PST submits with `today = "Wednesday UTC"` while it's still Tuesday locally. Two consequences:

- Streak day boundaries are at UTC midnight; users in negative timezones lose streaks unfairly.
- DST transitions: `Date.now() - 86400000` is exactly 24h, but local DST days are 23h or 25h. Once a year, "yesterday" is computed wrong.

**Fix:** use `toLocaleDateString('sv-SE')` (returns local-TZ ISO) or `Intl.DateTimeFormat`. Or compute on the backend with the user's IANA timezone passed at session start.

---

### I3. `Date.now().toString()` as message ID — collision risk

**File:** `my-language-coach/components/ChatScreen.js:443`, `:590`, `:608`

JS timer resolution is ~1ms. `setMessages` is called for the user's message immediately after `transcribeAudio` returns, then again for the coach's reply. On a fast device with cached transcription, both can land in the same ms. Two messages with the same `id` → React `key` warning + buggy FlatList behavior.

**Fix:** `crypto.randomUUID()` or a monotonic counter.

---

### I4. `speechLockRef` can deadlock permanently

**File:** `my-language-coach/components/ChatScreen.js:177-182`

```js
sound.setOnPlaybackStatusUpdate((status) => {
  if (!status.isPlaying) {
    speechLockRef.current = false;
    sound.setOnPlaybackStatusUpdate(null);
  }
});
```

If the sound never plays (load failure, audio session conflict, app interruption mid-load), the callback never fires, and `speechLockRef.current` stays `true` forever. Subsequent `safeSpeak` calls all silently no-op (line 147). Symptom: coach goes mute and only an app restart recovers.

**Fix:** unlock in a `try { ... } finally { speechLockRef.current = false }` plus a 10-second timeout fallback.

---

### I5. `pulseAnim` recreated on every render

**File:** `my-language-coach/components/ChatScreen.js:73`

```js
const pulseAnim = useState(new Animated.Value(1))[0];
```

`useState`'s initializer runs on every render — `new Animated.Value(1)` is allocated each time, then discarded. Wasteful (and a frequent source of frame drops with Animated).

**Fix:** `const pulseAnim = useRef(new Animated.Value(1)).current;`.

---

### I6. `useFocusEffect` deps include the full `userParams` object

**File:** `my-language-coach/components/ChatScreen.js:217`, `:253`

`userParams` is a fresh object every time `setUserParams` is called. Object identity changes on any update → focus effect re-fires → conversation reinitializes when only e.g. `streakCount` changed.

**Fix:** destructure to primitives in the dep array (`[userName, languageCode, languageName]`).

---

### I7. ProgressScreen clobbers in-flight state

**File:** `my-language-coach/components/ProgressScreen.js:31-44`

`useFocusEffect` fetches the user from the server on every focus and overwrites the entire `userParams` blob — including `practiceDates`, `streakCount`, etc. If ChatScreen has just locally optimistically updated streak, navigating to Progress wipes it.

**Fix:** use TanStack Query (or equivalent) so all screens share the same cached user object with proper invalidation. See [Recommended rebuild stack](#recommended-rebuild-stack).

---

### I8. ProfileScreen save loses fields

**File:** `my-language-coach/components/ProfileScreen.js:70-78`

`handleSave` calls `setUserParams({...})` with only the form fields. `streakCount`, `practiceDates`, `goalCompletedDate`, `lastPracticeDate`, `minutesSpoken` are all dropped from context. ProgressScreen will then show 0 streak / no calendar dots until a refetch happens.

**Fix:** spread the previous params: `setUserParams(prev => ({ ...prev, ...changes }))`.

---

### I9. `alert()` instead of `Alert.alert`

**File:** `my-language-coach/components/ChatScreen.js:502`

`alert("Microphone permission denied")` uses the web global. RN polyfills it inconsistently; on bare RN it can crash. Use `Alert.alert` from `react-native`.

---

### I10. ChatList "waveform" is fake

**File:** `my-language-coach/components/ChatList.js:24-33`

```js
newWaveforms[msg.id] = Array.from(
  { length: 10 },
  () => Math.floor(Math.random() * 20) + 5,
);
```

Pure decoration; misrepresents the audio. Either compute real RMS chunks during recording and store them with the message, or drop the visualization.

---

### I11. Daily quote rotates by day-of-month

**File:** `my-language-coach/components/HomeScreen.js:19`

```js
const dayIndex = new Date().getDate() % dailyQuotes.length;
```

The quote on the 1st of every month is the same; same for the 2nd; etc. If you have 30 quotes, each month repeats. Use day-of-year or a seeded shuffle (or fetch from a CMS).

---

### I12. `silenceDetectedRef` semantics & RMS threshold

**File:** `my-language-coach/components/ChatScreen.js:523`, `:537`

`silenceDetectedRef.current = true` is the initial value (assumed silent), then `if (rms > 500) silenceDetectedRef.current = false`. The variable name suggests "silence happened"; the actual semantics is "no loud audio detected yet". Worse, RMS threshold of 500 on PCM16 is arbitrary — a soft speaker in a quiet environment fails this check, falls through to `fallbackMessages[languageCode]`, looking like the coach can't hear them.

**Fix:** rename to `loudAudioDetectedRef` (default `false`), and compute the threshold adaptively from the noise floor (or just remove client-side silence detection — Whisper handles silence fine).

---

### I13. RMS calculation runs on every audio chunk in JS

**File:** `my-language-coach/components/ChatScreen.js:524-543`

The `AudioRecord.on("data", ...)` callback parses every PCM16 sample on the JS thread for every chunk. At 16kHz mono PCM16 that's 32KB/sec into JS, looped per-sample. Battery drain + JS thread contention with React rendering.

**Fix:** move to a native module, downsample (every 10th sample is plenty for RMS), or remove (see I12).

---

### I14. `BACKEND_URL` is hard-coded

**File:** `my-language-coach/services/api.js:7`

```js
const BACKEND_URL = "https://my-language-coach-backend.onrender.com/api";
```

No env var, no `app.config.js` extra, no per-build configuration. Can't run a local backend, can't have staging, can't rotate hostnames without an app redeploy.

**Fix:** read from `Constants.expoConfig.extra.backendUrl`, set per EAS build profile in `eas.json`.

---

### I15. Render free tier cold starts

The backend is on Render free tier. The Render dashboard for `srv-d0chopadbo4c73ffofc0` shows the official banner: _"Your free instance will spin down with inactivity, which can delay requests by 50 seconds or more"_. The voice loop is unusable for the first turn after any inactivity. Combined with C2 (no rate limiting) this is the primary UX complaint anyone using the app would have. It's also why MongoDB Atlas auto-paused — no traffic for the cluster either.

**Fix (rebuild):** Fly.io ($2-5/mo `shared-cpu-1x`) or Railway with a min-instances=1, or Cloudflare Workers if the stack is JS-only and DB is on Hyperdrive/Neon.

---

### I16. `.env` exists in `my-language-coach-backend/` but no `.env.example`

`.gitignore` correctly ignores `.env`, but onboarding any other developer is a "guess the variable names" exercise. Add `.env.example` listing `MONGODB_URI`, `OPENAI_API_KEY`, `GOOGLE_TTS_API_KEY`, `PORT` with stub values.

---

### I17. No error reporting, no analytics, no crash logs

`remoteLog` → `console.log` → Render's free-tier logs that rotate quickly is your only telemetry. Means iPhone audio bugs (and any future regression) go undetected unless a user emails you. **Sentry** (free tier covers a hobby app) for both mobile and backend; **PostHog** for product analytics.

---

### I18. `fetchUser` in ChatScreen reads `deviceId` from stale closure

**File:** `my-language-coach/components/ChatScreen.js:294-312`

`useEffect(() => { fetchUser(); }, [])` runs once on mount. But `deviceId` comes from `userParams` via context, which is `undefined` on first render until `App.js`'s init effect resolves. So `fetchUserData(undefined)` calls `/api/user/undefined` — 404 every time. The error is swallowed by `console.error`, the streak/lastPracticeDate state never hydrates correctly on this screen, and falls back to whatever `App.js` initially set.

**Fix:** depend on `[deviceId]` and gate with `if (!deviceId) return;`.

---

## Code smells & quality

### S1. `ChatScreen.js` is 845 lines

Conversation logic, audio session, recording, transcription, GPT call, TTS, caching, exit modal, share-conversation, app-state listener, navigation header, streak update, and timer all in one file. Untestable. Every change risks regressions across unrelated features.

### S2. No tests, anywhere

Backend `npm test` is the placeholder `echo "Error: no test specified" && exit 1`. There is no Jest, no React Testing Library, no Detox/Maestro, no Vitest. Pure functions like `sanitizeForSpeech`, the streak math, `getMarkedDates`, `formatPracticeTime` are trivially testable and would have prevented C1 and I2.

### S3. No TypeScript

For a codebase passing structured `messages` arrays (role/content), backend shapes (`User`), and language objects (`{name, code, flag, label}`), TS would have caught I8 (the dropped fields in ProfileScreen) and made refactoring much safer. Note: TS would _not_ catch C1 — types match for both functions — so a unit test is still required.

### S4. No ESLint, no Prettier

Mixed quote styles, mixed import order, mixed early-return style. Ad-hoc `console.log` with emojis throughout, no removal at build time.

### S5. Two parallel filesystem APIs

Both `react-native-fs` (`RNFS`) and `expo-file-system` are used in `ChatScreen.js`. `RNFS` is redundant — `expo-file-system` covers all the operations performed. Drop one dependency.

### S6. `global.Buffer = Buffer` in a screen file

`ChatScreen.js:59` pollutes the global scope from a UI component. Fine in RN, but it should live in an entry-point polyfill module.

### S7. Bash + PowerShell setup scripts that nuke `node_modules` + `android/`

`setup-dependencies.sh` and `setup-dependencies.ps1` exist because Expo prebuild + lockfile drift is painful in this codebase. With Expo SDK 54+ and CNG (Continuous Native Generation), this should not be needed at all in the rebuild.

### S8. Translation strings hard-coded

`dailyQuotes`, `congratulationMessages`, `fallbackMessages`, `greetingMessages`, `languages` all live in `utils/constants.js` / `utils/quotes.js`. A typo in any string requires an app store release. Move to i18n JSON, ideally fetched from a CMS or feature-flag service so copy can change without a release.

### S9. Two competing `useFocusEffect` cleanups

`ChatScreen.js:217` and `:423` both null-out `currentSoundRef.current`. Hard to reason about which one wins when both fire. The second is dead code given the first.

### S10. Magic numbers

`200` (iOS audio delay), `500` (RMS threshold), `1000` (file-too-small bytes at `:654`), `4000`/`3000` (popup auto-hide), `86400000` (ms in a day). Each is a future bug. Extract into named constants with comments explaining why.

### S11. `useState` for derived booleans

`goalCompletedToday` could be `goalCompletedDate === today`. Storing it in state means two sources of truth.

### S12. `flagMap.js` only contains French

`utils/flagMap.js` only maps `fr` to a PNG. Either it's used somewhere I missed (and broken for 11 of 12 languages), or it's dead code. Delete or complete.

### S13. `cors()` allows everything by default

Already covered in C2, but worth emphasizing as a code-quality issue: `cors()` with no config is a 1-line policy decision that needs to be explicit, not default.

---

## Tech-choice critique (2026 lens)

### Voice loop architecture is two generations behind

The current pipeline:

```
Mic → react-native-audio-record → base64 encode → POST → Whisper → GPT-4o → Google TTS → base64 → write to disk → expo-av play
```

End-to-end latency: 4-8 s on a good day, much worse on Render cold start. In 2026 the reference architecture is:

- **OpenAI Realtime API** (or **Gemini Live**, or self-hosted **Cartesia + Deepgram**) — bidirectional WebSocket/WebRTC, voice-to-voice, sub-500ms turn-taking. No Whisper, no separate TTS, no base64. Built-in voice activity detection eliminates the push-to-talk button.
- If sticking with the three-step pipeline: stream GPT-4o's tokens to TTS so the first sentence plays while the rest is still generating.
- **Deepgram Nova-3** or **AssemblyAI Universal-2** for streaming transcription if Realtime API isn't an option.

This single change eliminates: the push-to-talk UX, the 200ms iOS hack, the `safeSpeak` lock, the audio file caching layer, and most of the audio bugs in this audit.

### TTS quality

Google Cloud TTS with `ssmlGender: "NEUTRAL"` and standard voices is robotic. **ElevenLabs**, **OpenAI `gpt-4o-mini-tts`** (with voice instructions for emotion/pacing), or **Cartesia Sonic** sound an order of magnitude more natural and now match Google's price point.

### Stack

| Component         | Current                                       | 2026 default                                               |
| ----------------- | --------------------------------------------- | ---------------------------------------------------------- |
| Expo              | SDK 52                                        | SDK 54+ (New Architecture default — Fabric + TurboModules) |
| Audio recording   | `react-native-audio-record` (abandoned ~2020) | `expo-audio`                                               |
| Audio playback    | `expo-av` (deprecated)                        | `expo-audio` / `expo-video`                                |
| Filesystem        | `react-native-fs` + `expo-file-system`        | `expo-file-system` only                                    |
| Language          | JavaScript                                    | TypeScript (Expo template default)                         |
| State (server)    | manual `setUserParams({...})` blob            | TanStack Query                                             |
| State (client)    | React Context                                 | Zustand or Jotai                                           |
| Routing           | `@react-navigation/*` manual config           | Expo Router (file-based)                                   |
| Styling           | StyleSheet                                    | StyleSheet or NativeWind                                   |
| Backend framework | Express 5                                     | Hono (Bun/Node), Fastify, or NestJS                        |
| ORM               | Mongoose                                      | Drizzle (preferred) or Prisma, on **Postgres**             |
| DB                | MongoDB Atlas                                 | Postgres (Neon, Supabase, RDS)                             |
| Hosting (API)     | Render free                                   | Fly.io / Railway / Cloudflare Workers                      |
| CI/CD             | none                                          | GitHub Actions + EAS Update                                |
| Auth              | none (`deviceId` only)                        | Clerk / Supabase Auth / WorkOS                             |
| Errors            | `console.log`                                 | Sentry                                                     |
| Analytics         | none                                          | PostHog or Amplitude                                       |

### App architecture gaps

- **No auth.** A reinstall = account loss, no multi-device, no email re-engagement. **Sign in with Apple** is required for App Store anyway if you offer any other social login.
- **No content moderation.** Voice → transcript → GPT-4o has no pre-check. App Store flags this for kids' apps.
- **No privacy policy / terms.** Sending voice to OpenAI requires explicit disclosure (App Store, Play Store, GDPR for EU users).
- **No offline support.** SQLite (`expo-sqlite`) for streak/progress data lets users see history without connection.
- **No push notifications.** Streak apps live and die on engagement reminders.
- **No deep linking, no app indexing, no share intent target.**
- **No EAS Update / OTA.** Fixing C1 today requires App Store + Play Store submissions. With EAS Update, JS-only fixes ship in seconds.

### Repo structure

Two siblings, each with their own `.git`, no shared types, no shared lint, no shared deps. Each defines its own `axios` version. Move to **pnpm workspaces** + **Turborepo** (or **Nx**) with a `packages/shared` package owning the User type, the languages list, the message schema, and Zod validators used on both ends.

---

## Testing

There is no test infrastructure of any kind. For the rebuild, the minimum bar:

- **Unit (Vitest):** streak math (covers C1, I2), message-ID generation, `sanitizeForSpeech`, language-object lookup helpers, `formatPracticeTime`, `getMarkedDates`.
- **Component (RNTL):** ChatList rendering, MicButton states, ExitModal interactions.
- **Integration:** API client error handling; optimistic update flows; reducer/selector tests.
- **E2E (Maestro, not Detox):** onboarding → first practice session → streak increment. Maestro is YAML, runs in CI, much easier to maintain than Detox.
- **Backend (Vitest + supertest):** every endpoint, mock OpenAI/Google with **MSW**.

---

## Recommended rebuild stack

This is one defensible default. Adapt freely.

### Repo

- **pnpm workspaces** + **Turborepo**.
- `apps/mobile` — Expo SDK 54+, TypeScript, Expo Router.
- `apps/api` — Hono on Bun (or Fastify on Node), TypeScript.
- `packages/shared` — Zod schemas, types, language list, prompt templates, used by both apps.
- `packages/ui` (optional, future) — if you ever ship a web companion.

### Mobile

- **Expo SDK 54+**, **TypeScript**, **Expo Router** (replaces the manual `Stack.Navigator` config).
- **`expo-audio`** (replaces `expo-av` + `react-native-audio-record`).
- **TanStack Query** for server state (kills the manual refetch + setUserParams pattern).
- **Zustand** for client-only state.
- **`expo-secure-store`** for tokens.
- **NativeWind** if you want Tailwind-like styling.
- **Sentry** wired in from day one.
- **PostHog** for product analytics.

### Voice loop

- **OpenAI Realtime API over WebRTC.** Eliminates Whisper / GPT / TTS round-trips, the iOS audio session pain, the file caching, and the push-to-talk UX. Use server-side ephemeral keys so the device never holds the OpenAI key.
- Fallback path with `gpt-4o-mini` + Whisper + `gpt-4o-mini-tts` for cheaper users.

### Auth

- **Clerk** or **Supabase Auth** — Sign in with Apple required for App Store; Google + magic-link email also supported.
- Migration: link each existing `deviceId` to a new account on first sign-in.

### Backend

- **Hono on Bun** (or **Fastify on Node** if Bun feels too new).
- **Postgres** + **Drizzle ORM** (Mongoose's flexibility is unused; your User schema is fixed).
- **Zod** for request validation on every endpoint.
- **`hono-rate-limiter`** (or `express-rate-limit` equivalent).
- **HMAC-signed requests** from the app, key rotated per release.
- **Realtime API ephemeral key minting** endpoint for the voice loop.
- **OpenTelemetry** + Sentry for observability.

### Hosting

- **Fly.io** or **Railway** for the API (no cold starts, $5-10/mo).
- **Neon** or **Supabase** for Postgres.
- **EAS Build** for app builds, **EAS Update** for OTA.

### CI/CD

- **GitHub Actions:** lint + typecheck + Vitest on PR; Maestro E2E on merge to main; auto EAS Update on merge to main; manual EAS Build for store releases.

### Sequencing (greenfield, no migration)

Rebuild is greenfield — no data, code, or accounts being reused from the legacy stack.

1. **Today (10 minutes):** rotate or delete `OPENAI_API_KEY` and `GOOGLE_TTS_API_KEY` in Render env for `srv-d0chopadbo4c73ffofc0`. This removes the only hot liability from the legacy stack (per [§Operational status](#operational-status-may-2026)).
2. **Decide by mid-June:** keep the existing Google Play developer account (requires uploading any Play Store track build before **4 July 2026**) or abandon it and create a fresh one with the rebuild. Fresh account means new package name, new app listing, no existing reviews/ratings.
3. **Setup phase:** scaffold the pnpm + Turborepo monorepo, wire up CI, create Sentry/PostHog/Clerk accounts, provision a paid Fly.io or Railway dyno + Neon Postgres.
4. **API phase:** Hono + Postgres + Drizzle, auth from day one (Clerk/Supabase), Zod on every endpoint, HMAC + rate limiting, OpenAI Realtime ephemeral-key minting endpoint.
5. **App phase:** Expo SDK 54+, TypeScript, Expo Router, `expo-audio`, Realtime API over WebRTC, TanStack Query, Sentry. No "claim old account" flow needed.
6. **Cutover:** Maestro E2E covering onboarding → first practice. Once the new app is live, retire Render service `srv-d0chopadbo4c73ffofc0`, delete the MongoDB Atlas cluster, and decide whether to delete the Google Cloud project `language-coach-app` (or reuse it for the new TTS/Speech keys to keep billing in one place).

Happy to draft a concrete repo skeleton + dependency list when you're ready.

---

## Account & service inventory

Reference for future sessions — the dashboards that own the legacy stack.

| Service                 | URL                                                                                                      | Identifier                                                                                                    | Status                                                  |
| ----------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Render (backend)        | https://dashboard.render.com/web/srv-d0chopadbo4c73ffofc0                                                | Service ID `srv-d0chopadbo4c73ffofc0`                                                                         | Free tier, cold                                         |
| Backend public URL      | https://my-language-coach-backend.onrender.com                                                           | —                                                                                                             | Live but cold-starting                                  |
| GitHub (backend source) | github.com/bruno77176/my-language-coach-backend                                                          | branch `main`                                                                                                 | —                                                       |
| Google Play Console     | https://play.google.com/console/u/0/developers/6284335031520163616/app/4972682278502773043/app-dashboard | Package `com.anonymous.mylanguagecoach`, Developer ID `6284335031520163616`                                   | Production inactive; account closure risk by 2026-07-04 |
| Google Cloud            | https://console.cloud.google.com/welcome?project=language-coach-app                                      | Project ID `language-coach-app`, project number `446154042539`                                                | Active, hosts TTS API key                               |
| MongoDB Atlas           | https://cloud.mongodb.com/v2/682488fd6828e674779045b6#/overview                                          | Org `Bruno's Org - 2025-0…`, Project `Project 0`, Cluster `Cluster0`                                          | Paused for inactivity                                   |
| Expo / EAS              | https://expo.dev/accounts/bruno77176/projects/my-language-coach                                          | Account `bruno77176`, project slug `my-language-coach`, EAS project ID `730e3dc2-1bf3-4ca3-94c4-1dc1795409f7` | Last submission 11 months ago                           |

Apple Developer ID for the legacy iOS submissions: `bruno.a.moise@gmail.com` (per `eas.json`).
