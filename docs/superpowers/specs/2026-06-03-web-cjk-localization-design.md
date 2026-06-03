# Marketing Site Localization into Japanese, Chinese & Korean — Design

**Date:** 2026-06-03
**Status:** Approved (brainstorming) — pending implementation plan

## Goal

Make the marketing site (`apps/web`) available in **Japanese (`ja`)**, **Mandarin Chinese (`zh`)**, and **Korean (`ko`)**, so these appear in the site's language switcher and the landing page renders fully translated — matching the experience the existing 10 non-English/French locales already get. This follows the app gaining ja/zh/ko as learning languages (PR #33, merged as `ac30f3b`).

## Scope

**In scope**

- Add `ja`/`zh`/`ko` as site UI locales: language-switcher entries, `/ja` `/zh` `/ko` localized landing pages, hreflang/canonical alternates.
- Full translation of the landing-page + chrome message catalog into the three languages.
- Correct rendering of CJK text (the current display/body fonts are Latin-only).

**Out of scope** (consistent with every current locale except English/French)

- Localizing the legal pages (`/privacy`, `/terms`, `/delete-account`). They remain English for ja/zh/ko, exactly as they do today for German, Italian, Spanish, etc. (The FR legal mirrors are a pre-existing exception we are not extending.)
- Any change to the app (`apps/mobile`) or API — already handled in PR #33.
- The "Available languages" strip — already updated in PR #33 (shows the new flags + "15 languages").

## Architecture

`apps/web/lib/i18n.ts` is the single source of truth for site locales. Everything downstream is already `LOCALES`-driven, so adding three entries cascades automatically with no change to the consuming files:

| Consumer                                   | File                                       | How it picks up ja/zh/ko                                    |
| ------------------------------------------ | ------------------------------------------ | ----------------------------------------------------------- |
| Language-switcher dropdown                 | `components/LanguagePicker.tsx`            | Maps `LOCALES` + `LOCALE_META` — no edit needed             |
| Localized landing routes `/ja` `/zh` `/ko` | `app/[locale]/page.tsx`                    | `generateStaticParams()` filters `LOCALES` — no edit needed |
| hreflang / canonical alternates            | `app/[locale]/page.tsx` `generateMetadata` | Built from `LOCALES` — no edit needed                       |
| Message loading                            | `lib/i18n.ts` `getMessages`                | Reads the `dictionaries` map (edited below)                 |

## Components / Changes

### 1. `apps/web/lib/i18n.ts`

- Add `"ja" | "zh" | "ko"` to the `Locale` union and to the `LOCALES` array.
- Add `LOCALE_META` entries:
  - `ja: { englishName: "Japanese", nativeName: "日本語", flag: "🇯🇵" }`
  - `zh: { englishName: "Chinese", nativeName: "中文", flag: "🇨🇳" }`
  - `ko: { englishName: "Korean", nativeName: "한국어", flag: "🇰🇷" }`
- Import the three new catalogs and add them to the `dictionaries` map.

### 2. New message catalogs

`apps/web/messages/ja.json`, `zh.json`, `ko.json` — full translations of `en.json` (same key structure as the other locales; the count copy already reads "15 languages" on main). Authored by LLM translation, **flagged for a native-speaker spot-check** (same quality bar as the app's quote translations in PR #33). Particular care: marketing taglines and the hero headline read naturally, not literally.

### 3. CJK fonts (the one real design decision)

Headings use **Fraunces** and body uses **DM Sans**, both loaded in `app/layout.tsx` via `next/font/google` with `subsets: ["latin"]` — **no CJK glyphs**. Without a fallback, ja/zh/ko text risks tofu/ugly rendering.

**Decision:** add a **system-CJK fallback stack** to the font family definitions (in `apps/web/tailwind.config.ts` `theme.fontFamily`, where `var(--font-fraunces)` / `var(--font-dm-sans)` are referenced). Append, after the existing Latin fallbacks:

```
"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic",
"Microsoft YaHei", "PingFang SC", "Malgun Gothic",
"Noto Sans CJK", "Noto Sans JP", "Noto Sans KR", "Noto Sans SC", sans-serif
```

- Latin locales are unaffected (Fraunces/DM Sans match first).
- CJK locales fall through to the OS's native CJK UI font — clean rendering, **zero added payload**.
- **Rejected alternative:** bundling Noto CJK via `next/font` — adds multi-MB font files per script for a marketing page; not worth it.

### 4. `apps/web/app/layout.tsx`

The root metadata hardcodes `alternates.languages` to only `{ en, fr }`. Extend it to include all locales (or at least ja/zh/ko) so the English root advertises the new translations for SEO. Minor, but correct.

## Data Flow

Request `/ja` → `app/[locale]/page.tsx` (statically generated via `generateStaticParams`) → `getMessages("ja")` returns `ja.json` → `<LandingPage locale="ja" />` renders with Japanese strings → CSS font stack resolves headings/body to a CJK system font.

## Error Handling / Edge Cases

- `getMessages` already falls back to the default (`en`) dictionary for an unknown locale.
- `/en` continues to 404 (English is served at root only) — unchanged.
- Invalid locale paths → `notFound()` — unchanged.

## Testing

- **`apps/web/lib/i18n.test.ts`** — extend/verify it covers the three new locales (each in `LOCALES`, has `LOCALE_META`, resolves a dictionary, `isLocale` true). If the test asserts an exact locale count, bump it.
- **JSON validity** — all three new catalogs parse and have the same top-level keys as `en.json` (no missing/extra sections).
- **`pnpm --filter web typecheck`** — passes (the `Messages` type is `typeof en`, so a catalog missing keys would surface here only if typed; validate key-parity explicitly regardless).
- **`pnpm --filter web build`** — passes and generates the new `/ja` `/zh` `/ko` static routes (route count rises from 11 to 14 non-default locale routes).
- **Manual** — load `/ja` `/zh` `/ko`: copy renders, headings/body are readable CJK (not tofu), language switcher shows and links to all three.

## Workflow

- Branch `feat/web-i18n-cjk` off `main` (`ac30f3b`, which already includes PR #33). Independent of any other in-flight branch — only touches `i18n.ts`, `layout.tsx`, `tailwind.config.ts`, the test, and three new files.
- Short-path worktree at `C:/Users/bruno.moise/mlc-web` (Windows MAX_PATH constraint — deep `.claude/worktrees/` paths break the toolchain).
- Subagent-driven execution; CI green (lint + typecheck + test + web build) before PR.
