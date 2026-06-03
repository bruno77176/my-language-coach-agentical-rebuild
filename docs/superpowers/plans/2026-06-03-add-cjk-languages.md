# Add Japanese, Mandarin Chinese & Korean Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three high-demand learning languages — Japanese (`ja`), Mandarin Chinese (`zh`), Korean (`ko`) — to the app and the marketing site, taking the supported count from 12 to 15.

**Architecture:** All language behaviour flows from a single source of truth, `packages/shared/src/languages.ts` (`LANGUAGES` + `SupportedLang`). Mobile onboarding/pickers, the coach prompt, TTS instructions and translation all resolve through `LANGUAGES.find(...)`, so adding three entries propagates automatically. Two places need real work: (1) `daily-quotes.ts` requires a translation into every `SupportedLang` for all 50 quotes — adding 3 langs forces 150 new strings and is a hard type-check gate; (2) STT routing — Deepgram `nova-3` covers `ja` + `ko` but **NOT** `zh`, so Chinese must route to `nova-2`.

**Tech Stack:** TypeScript, pnpm monorepo (Turbo), Vitest (API), Drizzle (rate cards), Deepgram STT (`nova-3`/`nova-2`), OpenAI `gpt-4o-mini-tts` (multilingual, no change needed), Expo React Native (mobile), Next.js + JSON message catalogs (web).

**Ship discipline:** This is **one atomic PR**. The moment `ja`/`zh`/`ko` are added to the `SupportedLang` union (Task 1), all 50 quote objects in `daily-quotes.ts` fail to type-check until Task 2 fills them. Do not push between Task 1 and Task 2 — CI must stay green (see `MEMORY.md` → always-keep-CI-green). Run from `app/`: `pnpm format && pnpm lint && pnpm typecheck && pnpm test` before any push.

---

## File Structure

- `packages/shared/src/languages.ts` — **modify**: add 3 entries to `LANGUAGES`, 3 members to `SupportedLang`, 3 codes to `SUPPORTED_LANG_CODES`.
- `packages/shared/src/daily-quotes.ts` — **modify**: add `ja`/`zh`/`ko` keys to the `translations` record of all 50 quotes.
- `apps/api/src/providers/deepgram.ts` — **modify**: per-language model selection (`zh` → `nova-2`, else `nova-3`); operation string follows the chosen model.
- `apps/api/src/providers/deepgram.test.ts` — **modify**: add a test asserting `zh` routes to `nova-2`.
- `apps/api/src/db/seed-rate-cards.ts` — **modify**: add a `transcribe:nova-2` rate card.
- `apps/web/messages/*.json` (12 files) — **modify**: bump "12 languages" → "15 languages".
- `apps/web/components/LanguagesStrip.tsx` — **modify** (optional marketing): add 🇯🇵🇨🇳🇰🇷 flags.

---

### Task 1: Extend the shared language list

**Files:**

- Modify: `app/packages/shared/src/languages.ts`

- [ ] **Step 1: Add the three language entries**

In `LANGUAGES`, after the Hungarian entry (line 25), before the closing `];`:

```ts
  { code: "ja", englishName: "Japanese", nativeName: "日本語", flag: "🇯🇵" },
  { code: "zh", englishName: "Chinese", nativeName: "中文", flag: "🇨🇳" },
  { code: "ko", englishName: "Korean", nativeName: "한국어", flag: "🇰🇷" },
```

> Order = display order in the onboarding picker. Appending keeps the existing list stable. If Bruno wants the commercial three near the top, move these three lines up — no other change needed.

- [ ] **Step 2: Extend the `SupportedLang` union**

Append to the union (after `| "hu"`):

```ts
  | "ja"
  | "zh"
  | "ko";
```

- [ ] **Step 3: Extend `SUPPORTED_LANG_CODES`**

Add to the array (after `"hu",`):

```ts
  "ja",
  "zh",
  "ko",
```

- [ ] **Step 4: Verify the type error surfaces in daily-quotes (expected, fixed in Task 2)**

Run: `cd app && pnpm --filter @language-coach/shared typecheck` (or `pnpm typecheck`)
Expected: FAIL — ~50 errors of the form _"Property 'ja' is missing in type ... but required in type 'Record<SupportedLang, string>'"_ in `daily-quotes.ts`. This confirms the type gate is working. Do **not** commit yet.

---

### Task 2: Translate all 50 daily quotes into ja / zh / ko

**Files:**

- Modify: `app/packages/shared/src/daily-quotes.ts`

This is content, not logic. Each of the 50 `DailyQuote` objects has a `translations: Record<SupportedLang, string>`. Add a `ja`, `zh`, and `ko` line to every one.

- [ ] **Step 1: Add the three keys to every quote, following this exact pattern**

Example — the first quote (`wittgenstein-grenzen`, ~line 35). Add after the `hu:` line, inside the `translations` block:

```ts
      ja: "私の言語の限界は私の世界の限界を意味する。",
      zh: "我的语言的界限意味着我的世界的界限。",
      ko: "내 언어의 한계는 내 세계의 한계를 의미한다.",
```

Repeat for all 50 quotes. **Recommended method:** these are famous quotes — prefer the canonical published translation where one exists; otherwise batch-translate with an LLM (`gpt-4o`) then have a native speaker spot-check (especially zh tone/register and ja keigo level). Do not ship machine output unread — a garbled quote on the Home screen is user-visible.

- [ ] **Step 2: Verify the type gate now passes**

Run: `cd app && pnpm typecheck`
Expected: PASS — zero errors. Every quote now satisfies `Record<SupportedLang, string>`.

- [ ] **Step 3: Run the shared package build + tests**

Run: `cd app && pnpm --filter @language-coach/shared build && pnpm --filter @language-coach/shared test`
Expected: PASS (or "no tests" — that's fine; the build proves the data compiles).

- [ ] **Step 4: Commit (first safe commit point — types are green again)**

```bash
cd app
git add packages/shared/src/languages.ts packages/shared/src/daily-quotes.ts
git commit -m "feat(shared): add Japanese, Chinese, Korean as supported languages"
```

---

### Task 3: Route Chinese STT to Deepgram nova-2

**Files:**

- Modify: `app/apps/api/src/providers/deepgram.ts`
- Test: `app/apps/api/src/providers/deepgram.test.ts`

**Why:** Verified 2026-06-03 — Deepgram `nova-3` supports `ja` and `ko` as dedicated languages but does **not** support Mandarin. `nova-2` supports 36 languages including `zh`. So `zh` must use `nova-2`; everything else stays on `nova-3`.

- [ ] **Step 1: Write the failing test**

Add to `deepgram.test.ts` inside the `describe("transcribeAudio", ...)` block:

```ts
it("routes Chinese (zh) to nova-2 and reports it in usage", async () => {
  const transcribeFile = vi.fn().mockResolvedValue({
    results: { channels: [{ alternatives: [{ transcript: "你好" }] }] },
    metadata: { duration: 2.0 },
  });
  const onUsage = vi.fn();
  const fakeClient = { listen: { v1: { media: { transcribeFile } } } };
  await transcribeAudio(fakeClient as never, {
    audioBuffer: Buffer.from("fake"),
    languageCode: "zh",
    onUsage,
  });
  expect(transcribeFile).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ model: "nova-2", language: "zh" }),
  );
  expect(onUsage).toHaveBeenCalledWith(
    expect.objectContaining({ operation: "transcribe:nova-2" }),
  );
});

it("keeps Japanese (ja) on nova-3", async () => {
  const transcribeFile = vi.fn().mockResolvedValue({
    results: { channels: [{ alternatives: [{ transcript: "こんにちは" }] }] },
    metadata: { duration: 2.0 },
  });
  const fakeClient = { listen: { v1: { media: { transcribeFile } } } };
  await transcribeAudio(fakeClient as never, {
    audioBuffer: Buffer.from("fake"),
    languageCode: "ja",
  });
  expect(transcribeFile).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ model: "nova-3", language: "ja" }),
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && pnpm --filter @language-coach/api test -- deepgram`
Expected: FAIL — the new `zh` test fails because the model is hardcoded to `nova-3` and the operation is `transcribe:nova-3`.

- [ ] **Step 3: Implement per-language model selection**

In `deepgram.ts`, add above `transcribeAudio` (after `createDeepgram`):

```ts
// Deepgram nova-3 covers most languages, incl. Japanese + Korean, but NOT
// Mandarin Chinese. Route zh to nova-2 (36 languages, incl. zh); everything
// else stays on nova-3. Verified against Deepgram docs 2026-06-03.
const NOVA2_LANGUAGES = new Set<string>(["zh"]);

export function deepgramModelForLanguage(languageCode: string): string {
  return NOVA2_LANGUAGES.has(languageCode) ? "nova-2" : "nova-3";
}
```

Then inside `transcribeAudio`, replace the hardcoded model. Change:

```ts
response = await client.listen.v1.media.transcribeFile(input.audioBuffer, {
  model: "nova-3",
  language: input.languageCode,
  smart_format: true,
  punctuate: true,
});
```

to:

```ts
const model = deepgramModelForLanguage(input.languageCode);
response = await client.listen.v1.media.transcribeFile(input.audioBuffer, {
  model,
  language: input.languageCode,
  smart_format: true,
  punctuate: true,
});
```

The `model` const is declared inside the `try`. Move it just above the `try` so the `onUsage` block can read it:

```ts
  const model = deepgramModelForLanguage(input.languageCode);
  let response;
  try {
    response = await client.listen.v1.media.transcribeFile(input.audioBuffer, {
      model,
      language: input.languageCode,
      smart_format: true,
      punctuate: true,
    });
  } catch (err) {
```

And in the `onUsage` block, change the operation string:

```ts
      input.onUsage({
        provider: "deepgram",
        operation: `transcribe:${model}`,
        seconds: durationSeconds,
      }),
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && pnpm --filter @language-coach/api test -- deepgram`
Expected: PASS — all existing tests (es/en → `transcribe:nova-3`) still pass; the two new tests pass.

- [ ] **Step 5: Commit**

```bash
cd app
git add apps/api/src/providers/deepgram.ts apps/api/src/providers/deepgram.test.ts
git commit -m "feat(api): route Chinese STT to Deepgram nova-2 (nova-3 lacks zh)"
```

---

### Task 4: Add the nova-2 rate card

**Files:**

- Modify: `app/apps/api/src/db/seed-rate-cards.ts`

**Why:** `recordUsage` looks up a rate card by `(provider, operation, unit_type)`. With Chinese now emitting `transcribe:nova-2`, a missing card means Chinese transcription cost is silently dropped from spend tracking.

- [ ] **Step 1: Add the seed entry**

In the `SEEDS` array, immediately after the existing Nova-3 block (ends ~line 81):

```ts
  // Deepgram Nova-2 (used for Mandarin Chinese — nova-3 lacks zh support)
  {
    provider: "deepgram",
    operation: "transcribe:nova-2",
    unitType: "seconds",
    pricePerUnit: "0.0000072", // mirror nova-3 PAYG; verify against billing
    // NOTE: verify the nova-2 pre-recorded PAYG rate — Deepgram tiers change.
  },
```

- [ ] **Step 2: Typecheck**

Run: `cd app && pnpm --filter @language-coach/api typecheck`
Expected: PASS.

- [ ] **Step 3: Seed the prod/staging DB (deploy-time, not local)**

> The seed only inserts when the `(provider, operation, unit_type, effective_from)` row is absent (`ON CONFLICT DO NOTHING`). After deploy, either run the seed script against the DB or add the `transcribe:nova-2` card via the admin UI (the canonical path for rate changes per the file's own comment). Document this in the PR description as a required post-deploy step.

- [ ] **Step 4: Commit**

```bash
cd app
git add apps/api/src/db/seed-rate-cards.ts
git commit -m "feat(api): add nova-2 rate card for Chinese transcription"
```

---

### Task 5: Bump marketing copy "12 languages" → "15 languages" (web)

**Files:**

- Modify: `app/apps/web/messages/{da,de,en,es,fr,hu,it,pt,ro,ru,sv,tr}.json` (12 files)
- Modify (optional): `app/apps/web/components/LanguagesStrip.tsx`

- [ ] **Step 1: Find every occurrence**

Run from `app/apps/web/`:

```bash
grep -rn -e "12 lang" -e "12 idiom" -e "12 langues" -e "Twelve" -e "Douze" messages/
```

Known hits (en): `meta.description` ("In 12 languages."), `hero.subheadline` ("in 12 languages"), `valueProps.v4` ("12 languages"), and a feature `body` ("Twelve to choose from — …"). Each locale mirrors these keys in its own language.

- [ ] **Step 2: Update each file**

In every one of the 12 files, change the numeral `12` → `15` in those keys, and the spelled-out number word where used:

- `en.json`: "Twelve to choose from" → "Fifteen to choose from"
- `fr.json`: "Douze au choix" → "Quinze au choix"
- All others: bump the `12` numeral to `15` in `meta.description`, `hero.subheadline`, `valueProps.v4` (and any spelled-out form that locale uses).

> Optional copy upgrade: the `features` body lists example languages ("French, German, Italian, Spanish, Turkish, Portuguese, and more"). Consider surfacing the new commercial three — e.g. "…Spanish, Japanese, Korean, Mandarin, and more" — since they're the headline additions.

- [ ] **Step 3 (optional): Show the new flags in LanguagesStrip**

In `LanguagesStrip.tsx`, extend the hardcoded array (currently 4 flags + "& more"):

```ts
const LANGUAGES: Array<{ flag: string; name: string }> = [
  { flag: "🇫🇷", name: "Français" },
  { flag: "🇩🇪", name: "Deutsch" },
  { flag: "🇯🇵", name: "日本語" },
  { flag: "🇰🇷", name: "한국어" },
  { flag: "🇨🇳", name: "中文" },
  { flag: "🇮🇹", name: "Italiano" },
];
```

- [ ] **Step 4: Typecheck + build the web app**

Run: `cd app && pnpm --filter web typecheck && pnpm --filter web build`
Expected: PASS (JSON catalogs compile; no broken message keys).

- [ ] **Step 5: Commit**

```bash
cd app
git add apps/web/messages/ apps/web/components/LanguagesStrip.tsx
git commit -m "feat(web): bump supported language count to 15, surface ja/ko/zh"
```

---

### Task 6: On-device verification (the polish gate)

**Files:** none (manual verification). Per `MEMORY.md` → verification-before-completion: no success claim without evidence.

- [ ] **Step 1: Full CI gate**

Run: `cd app && pnpm format && pnpm lint && pnpm typecheck && pnpm test`
Expected: all green.

- [ ] **Step 2: CJK font rendering on device**

The custom fonts (Fraunces + DM Sans) contain no kanji/hanzi/hangul glyphs. Build a dev client and confirm `日本語`, `中文`, `한국어` render as real glyphs (not tofu `▢▢▢`) in:

- onboarding `target-lang` / `native-lang` pickers,
- the Profile `edit-language-sheet`,
- the Home `quote-card` (a quote translated into the selected CJK language).

If tofu appears: add a system-font fallback for CJK text (`fontFamily` undefined / platform default for the affected `EditorialText` variants), since RN does not auto-fallback custom fonts to CJK on all devices.

- [ ] **Step 3: Real STT smoke test per language**

With the API pointed at a real Deepgram key, run one live conversation turn in each new language:

- `ja` → expect a sane transcript (nova-3),
- `ko` → expect a sane transcript (nova-3),
- `zh` → **critical** — speak Mandarin, expect a non-empty transcript proving nova-2 routing works end-to-end (not `AUDIO_SILENT`).

- [ ] **Step 4: TTS sanity per language**

Confirm `gpt-4o-mini-tts` speaks each language with the correct accent (recall `MEMORY.md` → tts-language-gotcha: the explicit "Speak in {englishName}" instruction in `ttsLanguageInstruction` is what prevents wrong-language audio — verify it fires for ja/zh/ko).

- [ ] **Step 5: Final commit / open PR**

```bash
cd app
git push -u origin <branch>
gh pr create --title "Add Japanese, Mandarin & Korean (12 → 15 languages)" --body "…"
```

PR body MUST note the post-deploy step from Task 4 (seed/admin-add the `transcribe:nova-2` rate card).

---

## Self-Review notes

- **Spec coverage:** config (T1), content/quotes (T2), STT routing for the verified `zh` gap (T3+T4), web copy (T5), on-device + font + live-STT verification (T6). TTS needs no code (single default voice, OpenAI multilingual). Mobile UI needs no code (all pickers map `LANGUAGES` from shared).
- **Atomicity:** T1 alone breaks type-check by design; T1+T2 land together as the first commit. No red push.
- **Type consistency:** `deepgramModelForLanguage` is the single name used in impl + tests; operation string is `transcribe:${model}` everywhere; rate card operation `transcribe:nova-2` matches the emitted usage operation.
- **Open item to confirm during T3:** exact Deepgram code for Mandarin — `zh` (ISO 639-1) is what the app stores; verify Deepgram nova-2 accepts `zh` directly, else map to `zh-CN` inside `transcribeAudio` only for the Deepgram call (keep `zh` as the app's stored code).
