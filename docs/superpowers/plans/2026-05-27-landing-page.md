# Marketing Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public marketing site at `apps/web/` that hosts a one-scroll landing page (EN + FR) with smart QR/store-button download CTAs, plus `/privacy` and `/terms` scaffolds, deployed to Vercel and ready to point `mylanguagecoach.app` at.

**Architecture:** New Next.js 14 (App Router) + Tailwind + TypeScript package in the existing monorepo, mirroring `apps/admin/`. Shares `@language-coach/design-tokens` for brand consistency. Static-generated pages, no API, no DB. Download URLs sourced from env vars so the TestFlight/store swap requires no code change. Two locales (`/` and `/fr`) served from the same component tree with a JSON message map. Vercel Web Analytics for traffic + four custom events.

**Tech Stack:**

- Framework: Next.js 14 (app router), React 18, TypeScript
- Styling: Tailwind CSS 3, `@language-coach/design-tokens`
- Fonts: Fraunces + DM Sans via `next/font/google`
- QR generation: `qrcode` npm package (build-time SVG)
- UA detection: `ua-parser-js`
- Analytics: `@vercel/analytics`
- MDX rendering: `@next/mdx` (privacy/terms)
- Testing: Vitest + `@testing-library/jest-dom` (lib unit tests only — no component tests for v1)
- Deploy: Vercel Hobby, free tier
- Domain: `mylanguagecoach.app` via Porkbun → Vercel

**Reference spec:** `docs/superpowers/specs/2026-05-27-landing-page-design.md`

---

## Important conventions (read first)

- **All `pnpm` commands** run from `apps/web/` unless explicitly noted otherwise. Root commands (e.g., `pnpm install`) are called out.
- **TypeScript strict mode is on** (inherited from `tsconfig.base.json`). No `any`. Prefer `unknown` + narrowing if the type is genuinely dynamic.
- **Design tokens are React-Native-shaped** (numbers, RN-specific shadow objects). Import only what works on web: `palette`, `gradients`, `font`, `radius`, `spacing`. Define web shadows inside `tailwind.config.ts` rather than importing the RN `shadow` object.
- **Tests run via Vitest.** Only library code (`lib/*`) gets unit tests in v1. Components are verified by manual smoke + Lighthouse + TypeScript. Don't write brittle DOM tests for marketing components.
- **Commit cadence:** commit at the end of every task using the Co-Authored-By line. Each commit message uses Conventional Commits (`feat:`, `chore:`, `docs:`, `test:`, etc.).
- **Never commit `.env.local`.** It's gitignored at the repo root.
- **Locale routing pattern:** EN is the root (`/`, `/privacy`, `/terms`). FR is a route segment (`/fr`, `/fr/privacy`, `/fr/terms`). The Next.js folder layout reflects this — there is NO `app/en/` folder.

---

## File structure overview

**New (entire `apps/web/` directory):**

```
apps/web/
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx
│   ├── fr/
│   │   ├── page.tsx
│   │   ├── privacy/page.tsx
│   │   └── terms/page.tsx
│   ├── privacy/page.tsx
│   ├── terms/page.tsx
│   └── api/health/route.ts
├── components/
│   ├── DownloadCTA.tsx
│   ├── Footer.tsx
│   ├── Features.tsx
│   ├── Hero.tsx
│   ├── HowItWorks.tsx
│   ├── LanguagesStrip.tsx
│   ├── LanguageSwitcher.tsx
│   ├── PhoneFrame.tsx
│   ├── ScrollDepthTracker.tsx
│   └── ValueStrip.tsx
├── content/
│   ├── privacy.en.mdx
│   ├── privacy.fr.mdx
│   ├── terms.en.mdx
│   └── terms.fr.mdx
├── lib/
│   ├── i18n.ts
│   ├── i18n.test.ts
│   ├── qr.ts
│   ├── qr.test.ts
│   ├── store-links.ts
│   ├── store-links.test.ts
│   ├── ua-detect.ts
│   └── ua-detect.test.ts
├── messages/
│   ├── en.json
│   └── fr.json
├── public/
│   ├── favicon.ico
│   ├── og-image.png
│   ├── character.png
│   └── screens/
│       ├── home.png
│       ├── practice.png
│       └── progress.png
├── .env.example
├── .gitignore
├── eslint.config.mjs
├── next.config.mjs
├── package.json
├── postcss.config.mjs
├── README.md
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json
└── vitest.config.ts
```

**Modified (root monorepo):**

- `pnpm-workspace.yaml` — already globs `apps/*` so nothing changes; verify only.
- `turbo.json` — already covers `typecheck`, `lint`, `test`, `build`; nothing changes.

---

### Task 1: Bootstrap apps/web package skeleton

**Files:**

- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.mjs`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/eslint.config.mjs`
- Create: `apps/web/.gitignore`
- Create: `apps/web/.env.example`
- Create: `apps/web/app/api/health/route.ts`

- [ ] **Step 1: Create the package.json**

`apps/web/package.json`:

```json
{
  "name": "@language-coach/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev -p 3002",
    "build": "next build",
    "start": "next start -p 3002",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@language-coach/design-tokens": "workspace:*",
    "@next/mdx": "^14.2.18",
    "@vercel/analytics": "^1.5.0",
    "next": "^14.2.18",
    "qrcode": "^1.5.4",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "ua-parser-js": "^2.0.0"
  },
  "devDependencies": {
    "@language-coach/config": "workspace:*",
    "@testing-library/jest-dom": "^6.6.3",
    "@types/node": "^25.6.2",
    "@types/qrcode": "^1.5.5",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@types/ua-parser-js": "^0.7.39",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.18.0",
    "eslint-config-next": "^14.2.18",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.16",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

`apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    },
    "allowJs": true,
    "noEmit": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.mjs**

`apps/web/next.config.mjs`:

```js
import createMDX from "@next/mdx";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  pageExtensions: ["ts", "tsx", "mdx"],
};

export default withMDX(nextConfig);
```

- [ ] **Step 4: Create postcss.config.mjs**

`apps/web/postcss.config.mjs`:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Create eslint.config.mjs**

`apps/web/eslint.config.mjs`:

```js
import nextConfig from "eslint-config-next";

export default [
  ...nextConfig,
  {
    ignores: [".next/**", "node_modules/**"],
  },
];
```

- [ ] **Step 6: Create .gitignore**

`apps/web/.gitignore`:

```
# Next.js
.next/
out/

# Vercel
.vercel/

# Env
.env*.local

# Test
coverage/

# TypeScript
*.tsbuildinfo
next-env.d.ts
```

- [ ] **Step 7: Create .env.example**

`apps/web/.env.example`:

```
NEXT_PUBLIC_IOS_URL=https://testflight.apple.com/join/yU7XNGSS
NEXT_PUBLIC_ANDROID_URL=https://play.google.com/store/apps/details?id=com.anonymous.mylanguagecoach
NEXT_PUBLIC_CONTACT_EMAIL=bruno.a.moise@gmail.com
NEXT_PUBLIC_SITE_URL=https://mylanguagecoach.app
```

- [ ] **Step 8: Create health route**

`apps/web/app/api/health/route.ts`:

```ts
export const dynamic = "force-static";

export function GET() {
  return Response.json({ ok: true });
}
```

- [ ] **Step 9: Install deps**

From repo root:

```
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app" && pnpm install
```

Expected: pnpm picks up the new `apps/web` workspace; no errors.

- [ ] **Step 10: Verify TypeScript compiles**

```
cd apps/web && pnpm typecheck
```

Expected: PASS, zero errors.

- [ ] **Step 11: Commit**

```
git add apps/web/
git commit -m "feat(web): bootstrap apps/web Next.js package skeleton"
```

---

### Task 2: Configure Tailwind with shared design tokens

**Files:**

- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/app/globals.css`

- [ ] **Step 1: Create tailwind.config.ts**

`apps/web/tailwind.config.ts`:

```ts
import type { Config } from "tailwindcss";
import { palette, radius, spacing } from "@language-coach/design-tokens";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.{md,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        peach: palette.peach,
        coral: palette.coral,
        mauve: palette.mauve,
        accent: palette.accent,
        "accent-deep": palette.accentDeep,
        ink: palette.ink,
        "ink-soft": palette.inkSoft,
        cream: palette.cream,
      },
      backgroundImage: {
        sunrise: `linear-gradient(135deg, ${palette.peach} 0%, ${palette.coral} 50%, ${palette.mauve} 100%)`,
        warmth:
          "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)",
      },
      borderRadius: {
        sm: `${radius.sm}px`,
        md: `${radius.md}px`,
        lg: `${radius.lg}px`,
        xl: `${radius.xl}px`,
        pill: `${radius.pill}px`,
      },
      spacing: {
        "section-y": "96px",
        "section-y-lg": "128px",
      },
      maxWidth: {
        content: "1140px",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        body: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 12px rgba(43, 29, 18, 0.06)",
        floating: "0 8px 24px rgba(43, 29, 18, 0.12)",
        cta: "0 10px 20px rgba(43, 29, 18, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
```

> Note: `spacing.xs/sm/md/...` from design-tokens are intentionally NOT mapped into Tailwind's spacing scale — Tailwind's defaults (0.5rem increments) already cover those use cases and map them collides with token names. The custom `section-y` / `section-y-lg` cover the only spacing values the design depends on.

- [ ] **Step 2: Create globals.css**

`apps/web/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    scroll-behavior: smooth;
  }

  body {
    @apply bg-cream text-ink font-body antialiased;
  }

  h1,
  h2,
  h3 {
    @apply font-display;
  }
}

@layer components {
  .btn-primary {
    @apply inline-flex items-center justify-center gap-2 rounded-pill bg-accent px-6 py-3 font-body font-medium text-cream shadow-cta transition hover:bg-accent-deep focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-cream;
  }

  .btn-secondary {
    @apply inline-flex items-center justify-center gap-2 rounded-pill border border-ink/15 bg-white px-6 py-3 font-body font-medium text-ink shadow-card transition hover:border-ink/30;
  }
}
```

- [ ] **Step 3: Verify typecheck still passes**

```
cd apps/web && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```
git add apps/web/tailwind.config.ts apps/web/app/globals.css
git commit -m "feat(web): wire Tailwind to shared design tokens"
```

---

### Task 3: Set up Vitest for lib unit tests

**Files:**

- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/vitest.setup.ts`

- [ ] **Step 1: Create vitest.config.ts**

`apps/web/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["lib/**/*.test.ts", "lib/**/*.test.tsx"],
  },
});
```

- [ ] **Step 2: Create vitest.setup.ts**

`apps/web/vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 3: Verify vitest runs with no tests**

```
cd apps/web && pnpm test
```

Expected: PASS with "No test files found, exiting with code 0" (or `--passWithNoTests` equivalent — Vitest v2 returns 0 by default when no matching files are found).

- [ ] **Step 4: Commit**

```
git add apps/web/vitest.config.ts apps/web/vitest.setup.ts
git commit -m "test(web): configure Vitest for lib unit tests"
```

---

### Task 4: lib/store-links — env-driven store URLs

**Files:**

- Create: `apps/web/lib/store-links.ts`
- Create: `apps/web/lib/store-links.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/lib/store-links.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { getStoreLinks, DEFAULT_IOS_URL, DEFAULT_ANDROID_URL } from "./store-links";

describe("getStoreLinks", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns defaults when env vars are unset", () => {
    vi.stubEnv("NEXT_PUBLIC_IOS_URL", "");
    vi.stubEnv("NEXT_PUBLIC_ANDROID_URL", "");
    const links = getStoreLinks();
    expect(links.ios).toBe(DEFAULT_IOS_URL);
    expect(links.android).toBe(DEFAULT_ANDROID_URL);
  });

  it("uses env vars when set", () => {
    vi.stubEnv("NEXT_PUBLIC_IOS_URL", "https://example.com/ios");
    vi.stubEnv("NEXT_PUBLIC_ANDROID_URL", "https://example.com/android");
    const links = getStoreLinks();
    expect(links.ios).toBe("https://example.com/ios");
    expect(links.android).toBe("https://example.com/android");
  });

  it("exports defaults that look like real store URLs", () => {
    expect(DEFAULT_IOS_URL).toMatch(/^https:\/\/testflight\.apple\.com\/join\//);
    expect(DEFAULT_ANDROID_URL).toMatch(/^https:\/\/play\.google\.com\/store\/apps\/details\?id=/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd apps/web && pnpm test lib/store-links.test.ts
```

Expected: FAIL (`getStoreLinks` not defined).

- [ ] **Step 3: Implement store-links.ts**

`apps/web/lib/store-links.ts`:

```ts
export const DEFAULT_IOS_URL = "https://testflight.apple.com/join/yU7XNGSS";
export const DEFAULT_ANDROID_URL =
  "https://play.google.com/store/apps/details?id=com.anonymous.mylanguagecoach";

export interface StoreLinks {
  ios: string;
  android: string;
}

export function getStoreLinks(): StoreLinks {
  return {
    ios: process.env.NEXT_PUBLIC_IOS_URL || DEFAULT_IOS_URL,
    android: process.env.NEXT_PUBLIC_ANDROID_URL || DEFAULT_ANDROID_URL,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```
cd apps/web && pnpm test lib/store-links.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```
git add apps/web/lib/store-links.ts apps/web/lib/store-links.test.ts
git commit -m "feat(web): add lib/store-links with env override + safe defaults"
```

---

### Task 5: lib/ua-detect — User-Agent → platform

**Files:**

- Create: `apps/web/lib/ua-detect.ts`
- Create: `apps/web/lib/ua-detect.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/lib/ua-detect.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { detectPlatform, type Platform } from "./ua-detect";

const cases: Array<{ name: string; ua: string; expected: Platform }> = [
  {
    name: "iPhone Safari",
    ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    expected: "ios",
  },
  {
    name: "iPad Safari",
    ua: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    expected: "ios",
  },
  {
    name: "Android Chrome",
    ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36",
    expected: "android",
  },
  {
    name: "Desktop macOS Chrome",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    expected: "desktop",
  },
  {
    name: "Desktop Windows Firefox",
    ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0",
    expected: "desktop",
  },
  {
    name: "Empty UA",
    ua: "",
    expected: "unknown",
  },
  {
    name: "Bot",
    ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    expected: "desktop",
  },
];

describe("detectPlatform", () => {
  for (const { name, ua, expected } of cases) {
    it(`detects ${name} as ${expected}`, () => {
      expect(detectPlatform(ua)).toBe(expected);
    });
  }

  it("returns 'unknown' when given null/undefined", () => {
    expect(detectPlatform(null)).toBe("unknown");
    expect(detectPlatform(undefined)).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd apps/web && pnpm test lib/ua-detect.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement ua-detect.ts**

`apps/web/lib/ua-detect.ts`:

```ts
import { UAParser } from "ua-parser-js";

export type Platform = "ios" | "android" | "desktop" | "unknown";

export function detectPlatform(ua: string | null | undefined): Platform {
  if (!ua) return "unknown";

  const parser = new UAParser(ua);
  const os = parser.getOS().name?.toLowerCase() ?? "";
  const deviceType = parser.getDevice().type;

  if (os === "ios") return "ios";
  if (os === "android") return "android";
  // Tablets that aren't iPadOS may report deviceType="tablet" with another OS — treat as desktop
  if (!deviceType || deviceType === "console" || deviceType === "smarttv") {
    return "desktop";
  }
  return "desktop";
}
```

- [ ] **Step 4: Run test to verify it passes**

```
cd apps/web && pnpm test lib/ua-detect.test.ts
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```
git add apps/web/lib/ua-detect.ts apps/web/lib/ua-detect.test.ts
git commit -m "feat(web): add lib/ua-detect to classify visitor platform"
```

---

### Task 6: lib/qr — build-time SVG QR codes

**Files:**

- Create: `apps/web/lib/qr.ts`
- Create: `apps/web/lib/qr.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/web/lib/qr.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateQrSvg } from "./qr";

describe("generateQrSvg", () => {
  it("returns SVG markup for a URL", async () => {
    const svg = await generateQrSvg("https://example.com");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("encodes the URL into the QR (lengths differ for different inputs)", async () => {
    const short = await generateQrSvg("a");
    const long = await generateQrSvg(
      "https://testflight.apple.com/join/yU7XNGSS-very-long-suffix-to-force-larger-qr",
    );
    expect(long.length).toBeGreaterThan(short.length);
  });

  it("uses a coral accent color for the foreground", async () => {
    const svg = await generateQrSvg("https://example.com", { color: "#d96b5b" });
    expect(svg).toContain("#d96b5b");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```
cd apps/web && pnpm test lib/qr.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement qr.ts**

`apps/web/lib/qr.ts`:

```ts
import QRCode from "qrcode";

export interface QrOptions {
  color?: string;
  size?: number;
}

export async function generateQrSvg(
  data: string,
  options: QrOptions = {},
): Promise<string> {
  const { color = "#2b1d12", size = 200 } = options;
  return QRCode.toString(data, {
    type: "svg",
    width: size,
    margin: 1,
    color: { dark: color, light: "#ffffff00" },
    errorCorrectionLevel: "M",
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```
cd apps/web && pnpm test lib/qr.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```
git add apps/web/lib/qr.ts apps/web/lib/qr.test.ts
git commit -m "feat(web): add lib/qr to render QR codes as inline SVG"
```

---

### Task 7: lib/i18n — typed message lookup + locale type

**Files:**

- Create: `apps/web/messages/en.json`
- Create: `apps/web/messages/fr.json`
- Create: `apps/web/lib/i18n.ts`
- Create: `apps/web/lib/i18n.test.ts`

- [ ] **Step 1: Create messages/en.json with all keys we'll need**

`apps/web/messages/en.json`:

```json
{
  "meta": {
    "title": "My Language Coach — Practice languages. Build confidence.",
    "description": "Your AI conversation partner. Talk to it, get instant corrections, and become fluent in any language — anywhere."
  },
  "hero": {
    "eyebrow": "Now in open beta",
    "headline": "Practice languages.",
    "headlineAccent": "Build confidence.",
    "subheadline": "Your AI conversation partner, in your pocket. Talk naturally — get instant feedback in the language you're learning.",
    "scanToInstall": "Scan to install",
    "iosLabel": "iOS — TestFlight",
    "androidLabel": "Android — Open beta",
    "iosCta": "Get it on TestFlight",
    "androidCta": "Get it on Google Play",
    "iosNote": "TestFlight beta — limited spots"
  },
  "valueStrip": {
    "v1": "Talk naturally",
    "v2": "Multiple languages",
    "v3": "Instant feedback",
    "v4": "No appointments"
  },
  "features": {
    "title": "Three things that make it work",
    "f1": {
      "title": "Speak. Get answered.",
      "body": "Tap, talk, and the coach replies in real time — voice you'd swear was human."
    },
    "f2": {
      "title": "Corrections that teach",
      "body": "Every mistake comes with a quick why-and-how, not a slap on the wrist."
    },
    "f3": {
      "title": "Anywhere, on your time",
      "body": "Five minutes on the bus or an hour on the couch — the coach is always there."
    }
  },
  "howItWorks": {
    "title": "How it works",
    "s1": { "n": "1", "title": "Pick a language", "body": "French, German, Italian, Turkish — more on the way." },
    "s2": { "n": "2", "title": "Start talking", "body": "Press the mic and just speak. The coach listens and replies." },
    "s3": { "n": "3", "title": "Improve every day", "body": "Track your streaks and see how far you've come." }
  },
  "languages": {
    "title": "Available languages",
    "more": "+ more coming soon"
  },
  "finalCta": {
    "title": "Ready to start talking?",
    "subtitle": "Two coffees a year would be too much. It's free during beta."
  },
  "footer": {
    "tagline": "Practice languages. Build confidence.",
    "links": {
      "privacy": "Privacy",
      "terms": "Terms",
      "contact": "Contact"
    },
    "switchLanguage": "Français",
    "copyright": "© 2026 My Language Coach"
  }
}
```

- [ ] **Step 2: Create messages/fr.json (same shape, French copy)**

`apps/web/messages/fr.json`:

```json
{
  "meta": {
    "title": "My Language Coach — Pratiquez les langues. Gagnez en confiance.",
    "description": "Votre partenaire de conversation alimenté par l'IA. Parlez-lui, recevez des corrections instantanées, et devenez fluide dans n'importe quelle langue."
  },
  "hero": {
    "eyebrow": "Disponible en bêta ouverte",
    "headline": "Pratiquez les langues.",
    "headlineAccent": "Gagnez en confiance.",
    "subheadline": "Votre partenaire de conversation IA, dans votre poche. Parlez naturellement — recevez des retours instantanés dans la langue que vous apprenez.",
    "scanToInstall": "Scannez pour installer",
    "iosLabel": "iOS — TestFlight",
    "androidLabel": "Android — Bêta ouverte",
    "iosCta": "Installer via TestFlight",
    "androidCta": "Installer sur Google Play",
    "iosNote": "Bêta TestFlight — places limitées"
  },
  "valueStrip": {
    "v1": "Parlez naturellement",
    "v2": "Plusieurs langues",
    "v3": "Retours instantanés",
    "v4": "Sans rendez-vous"
  },
  "features": {
    "title": "Trois choses qui font la différence",
    "f1": {
      "title": "Parlez. Recevez une réponse.",
      "body": "Appuyez, parlez, et le coach répond en temps réel — une voix qu'on jurerait humaine."
    },
    "f2": {
      "title": "Des corrections qui enseignent",
      "body": "Chaque erreur s'accompagne d'un pourquoi-comment, pas d'une réprimande."
    },
    "f3": {
      "title": "Partout, à votre rythme",
      "body": "Cinq minutes dans le bus ou une heure sur le canapé — le coach est toujours là."
    }
  },
  "howItWorks": {
    "title": "Comment ça marche",
    "s1": { "n": "1", "title": "Choisissez une langue", "body": "Français, allemand, italien, turc — d'autres arrivent." },
    "s2": { "n": "2", "title": "Commencez à parler", "body": "Appuyez sur le micro et parlez. Le coach écoute et répond." },
    "s3": { "n": "3", "title": "Progressez chaque jour", "body": "Suivez vos séries et voyez votre progression." }
  },
  "languages": {
    "title": "Langues disponibles",
    "more": "+ d'autres bientôt"
  },
  "finalCta": {
    "title": "Prêt à commencer à parler ?",
    "subtitle": "Deux cafés par an seraient déjà trop. C'est gratuit pendant la bêta."
  },
  "footer": {
    "tagline": "Pratiquez les langues. Gagnez en confiance.",
    "links": {
      "privacy": "Confidentialité",
      "terms": "Conditions",
      "contact": "Contact"
    },
    "switchLanguage": "English",
    "copyright": "© 2026 My Language Coach"
  }
}
```

- [ ] **Step 3: Write the failing test**

`apps/web/lib/i18n.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getMessages, type Locale } from "./i18n";
import en from "../messages/en.json";
import fr from "../messages/fr.json";

describe("getMessages", () => {
  it("returns en for 'en'", () => {
    expect(getMessages("en")).toEqual(en);
  });

  it("returns fr for 'fr'", () => {
    expect(getMessages("fr")).toEqual(fr);
  });

  it("falls back to en for unknown locale", () => {
    // @ts-expect-error: testing invalid input on purpose
    expect(getMessages("zz")).toEqual(en);
  });
});

describe("locale message shape", () => {
  it("fr has every key en has", () => {
    const enKeys = collectKeys(en);
    const frKeys = collectKeys(fr);
    const missing = enKeys.filter((k) => !frKeys.includes(k));
    expect(missing, `Missing FR keys: ${missing.join(", ")}`).toEqual([]);
  });
});

function collectKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) =>
    collectKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}
```

- [ ] **Step 4: Run test to verify it fails**

```
cd apps/web && pnpm test lib/i18n.test.ts
```

Expected: FAIL (`getMessages` not defined).

- [ ] **Step 5: Implement i18n.ts**

`apps/web/lib/i18n.ts`:

```ts
import en from "../messages/en.json";
import fr from "../messages/fr.json";

export type Locale = "en" | "fr";
export const LOCALES: readonly Locale[] = ["en", "fr"] as const;
export const DEFAULT_LOCALE: Locale = "en";

export type Messages = typeof en;

const dictionaries: Record<Locale, Messages> = {
  en,
  fr: fr as Messages,
};

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE];
}

export function otherLocale(locale: Locale): Locale {
  return locale === "en" ? "fr" : "en";
}

// Maps an EN-rooted path to the equivalent path in the target locale.
// "/" + en → "/", "/" + fr → "/fr", "/privacy" + fr → "/fr/privacy".
export function localizedPath(pathname: string, locale: Locale): string {
  const stripped = pathname.replace(/^\/fr(?=\/|$)/, "") || "/";
  if (locale === "en") return stripped;
  return stripped === "/" ? "/fr" : `/fr${stripped}`;
}
```

- [ ] **Step 6: Run test to verify it passes**

```
cd apps/web && pnpm test lib/i18n.test.ts
```

Expected: PASS, 4 tests.

- [ ] **Step 7: Add localizedPath tests**

Update the top of `apps/web/lib/i18n.test.ts` to also import `localizedPath`:

```ts
import { getMessages, localizedPath, type Locale } from "./i18n";
```

Then append:

```ts
describe("localizedPath", () => {
  const cases: Array<[string, Locale, string]> = [
    ["/", "en", "/"],
    ["/", "fr", "/fr"],
    ["/fr", "en", "/"],
    ["/fr", "fr", "/fr"],
    ["/privacy", "en", "/privacy"],
    ["/privacy", "fr", "/fr/privacy"],
    ["/fr/privacy", "en", "/privacy"],
    ["/fr/privacy", "fr", "/fr/privacy"],
    ["/terms", "fr", "/fr/terms"],
  ];

  for (const [input, locale, expected] of cases) {
    it(`localizedPath(${input}, ${locale}) === ${expected}`, () => {
      expect(localizedPath(input, locale)).toBe(expected);
    });
  }
});
```

- [ ] **Step 8: Run all i18n tests**

```
cd apps/web && pnpm test lib/i18n.test.ts
```

Expected: PASS, 13 tests.

- [ ] **Step 9: Commit**

```
git add apps/web/lib/i18n.ts apps/web/lib/i18n.test.ts apps/web/messages/
git commit -m "feat(web): add EN/FR message dictionaries and typed i18n helpers"
```

---

### Task 8: PhoneFrame component (reusable phone-bezel wrapper)

**Files:**

- Create: `apps/web/components/PhoneFrame.tsx`

- [ ] **Step 1: Implement PhoneFrame.tsx**

`apps/web/components/PhoneFrame.tsx`:

```tsx
import Image from "next/image";

interface PhoneFrameProps {
  src: string;
  alt: string;
  /** Tailwind width class for the phone, e.g. "w-[240px]" */
  widthClass?: string;
  /** Optional rotation degrees for casual stacking */
  rotate?: number;
  className?: string;
  priority?: boolean;
}

export function PhoneFrame({
  src,
  alt,
  widthClass = "w-[260px]",
  rotate = 0,
  className = "",
  priority = false,
}: PhoneFrameProps) {
  return (
    <div
      className={`relative ${widthClass} aspect-[9/19] rounded-[36px] border-[6px] border-ink/90 bg-ink/90 shadow-floating overflow-hidden ${className}`}
      style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 1024px) 260px, 320px"
        className="object-cover"
        priority={priority}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```
cd apps/web && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```
git add apps/web/components/PhoneFrame.tsx
git commit -m "feat(web): add PhoneFrame component for reusable phone bezels"
```

---

### Task 9: DownloadCTA component (QR + smart store buttons)

**Files:**

- Create: `apps/web/components/DownloadCTA.tsx`

- [ ] **Step 1: Implement DownloadCTA.tsx**

`apps/web/components/DownloadCTA.tsx`:

```tsx
import { headers } from "next/headers";
import { getStoreLinks } from "@/lib/store-links";
import { detectPlatform, type Platform } from "@/lib/ua-detect";
import { generateQrSvg } from "@/lib/qr";
import { MobileButtonClient } from "./DownloadCTA.client";
import type { Messages } from "@/lib/i18n";

interface DownloadCTAProps {
  messages: Messages["hero"];
  variant?: "hero" | "final";
}

export async function DownloadCTA({ messages, variant = "hero" }: DownloadCTAProps) {
  const ua = headers().get("user-agent");
  const platform = detectPlatform(ua);
  const links = getStoreLinks();

  // Pre-render both QR codes at build/request time — CSS hides the ones we don't need
  const [iosQr, androidQr] = await Promise.all([
    generateQrSvg(links.ios, { color: "#2b1d12", size: 180 }),
    generateQrSvg(links.android, { color: "#2b1d12", size: 180 }),
  ]);

  return (
    <div className="space-y-6">
      {/* Desktop: QR codes */}
      <div className="hidden lg:block">
        <p className="font-body text-sm uppercase tracking-[0.16em] text-ink-soft/70 mb-4">
          {messages.scanToInstall}
        </p>
        <div className="flex gap-6">
          <QrCard
            svg={iosQr}
            label={messages.iosLabel}
            url={links.ios}
            eventName="cta_ios_click"
          />
          <QrCard
            svg={androidQr}
            label={messages.androidLabel}
            url={links.android}
            eventName="cta_android_click"
          />
        </div>
      </div>

      {/* Mobile: store buttons. Client component handles per-OS visibility */}
      <MobileButtons
        platform={platform}
        messages={messages}
        links={links}
        variant={variant}
      />
    </div>
  );
}

function QrCard({
  svg,
  label,
  url,
  eventName,
}: {
  svg: string;
  label: string;
  url: string;
  eventName: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-ink/10 bg-white p-4 shadow-card">
      <div
        className="h-[180px] w-[180px]"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="font-body text-xs font-medium text-ink-soft">{label}</p>
      <a
        href={url}
        className="font-body text-xs text-accent hover:text-accent-deep underline"
        data-event={eventName}
      >
        {label.split(" — ")[0]}
      </a>
    </div>
  );
}

// Client-side button row that re-checks platform after hydration (handles static cache mismatches)
function MobileButtons({
  platform,
  messages,
  links,
  variant,
}: {
  platform: Platform;
  messages: Messages["hero"];
  links: { ios: string; android: string };
  variant: "hero" | "final";
}) {
  return (
    <div className="lg:hidden flex flex-col gap-3 items-stretch max-w-sm mx-auto">
      <MobileButtonClient
        platform={platform}
        iosLabel={messages.iosCta}
        androidLabel={messages.androidCta}
        iosUrl={links.ios}
        androidUrl={links.android}
        iosNote={messages.iosNote}
        variant={variant}
      />
    </div>
  );
}
```

> **Note:** `headers()` is called in this Server Component, which makes the parent page dynamically rendered (not statically generated). This is acceptable for a low-traffic landing page and keeps the UA-detection code simple. The spec mentioned "both code paths render — CSS just hides the wrong one" to preserve static generation; we trade that off here because per-request rendering is correct under any CDN behavior and the cost is negligible for a marketing page.

- [ ] **Step 2: Create the client component for hydration-safe mobile buttons**

`apps/web/components/DownloadCTA.client.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { detectPlatform, type Platform } from "@/lib/ua-detect";
import { track } from "@vercel/analytics";

interface Props {
  platform: Platform;
  iosLabel: string;
  androidLabel: string;
  iosUrl: string;
  androidUrl: string;
  iosNote: string;
  variant: "hero" | "final";
}

export function MobileButtonClient({
  platform: serverPlatform,
  iosLabel,
  androidLabel,
  iosUrl,
  androidUrl,
  iosNote,
  variant,
}: Props) {
  const [platform, setPlatform] = useState<Platform>(serverPlatform);

  useEffect(() => {
    // Re-detect client-side to survive static caching
    setPlatform(detectPlatform(navigator.userAgent));
  }, []);

  const showIos = platform === "ios" || platform === "unknown";
  const showAndroid = platform === "android" || platform === "unknown";

  return (
    <>
      {showIos && (
        <>
          <a
            href={iosUrl}
            className="btn-primary w-full"
            onClick={() => track("cta_ios_click", { variant })}
          >
            {iosLabel}
          </a>
          <p className="font-body text-xs text-ink-soft/70 text-center">{iosNote}</p>
        </>
      )}
      {showAndroid && (
        <a
          href={androidUrl}
          className="btn-primary w-full"
          onClick={() => track("cta_android_click", { variant })}
        >
          {androidLabel}
        </a>
      )}
    </>
  );
}
```

- [ ] **Step 3: Verify typecheck**

```
cd apps/web && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```
git add apps/web/components/DownloadCTA.tsx apps/web/components/DownloadCTA.client.tsx
git commit -m "feat(web): add DownloadCTA with QR codes (desktop) and smart buttons (mobile)"
```

---

### Task 10: LanguageSwitcher + Footer

**Files:**

- Create: `apps/web/components/LanguageSwitcher.tsx`
- Create: `apps/web/components/Footer.tsx`

- [ ] **Step 1: Implement LanguageSwitcher (client component)**

`apps/web/components/LanguageSwitcher.tsx`:

```tsx
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { track } from "@vercel/analytics";
import { localizedPath, otherLocale, type Locale } from "@/lib/i18n";

interface Props {
  currentLocale: Locale;
  label: string;
}

export function LanguageSwitcher({ currentLocale, label }: Props) {
  const pathname = usePathname() ?? "/";
  const target = otherLocale(currentLocale);
  const href = localizedPath(pathname, target);

  return (
    <Link
      href={href}
      className="font-body text-sm text-ink-soft underline-offset-4 hover:underline"
      onClick={() => track("language_switch", { to: target })}
    >
      {label}
    </Link>
  );
}
```

- [ ] **Step 2: Implement Footer**

`apps/web/components/Footer.tsx`:

```tsx
import Link from "next/link";
import { LanguageSwitcher } from "./LanguageSwitcher";
import type { Messages, Locale } from "@/lib/i18n";

interface FooterProps {
  messages: Messages["footer"];
  locale: Locale;
}

export function Footer({ messages, locale }: FooterProps) {
  const prefix = locale === "fr" ? "/fr" : "";
  const contactEmail =
    process.env.NEXT_PUBLIC_CONTACT_EMAIL || "bruno.a.moise@gmail.com";

  return (
    <footer className="border-t border-ink/10 bg-cream">
      <div className="max-w-content mx-auto px-6 py-12 flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="font-display text-lg text-ink">My Language Coach</p>
          <p className="font-body text-sm text-ink-soft">{messages.tagline}</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 font-body text-sm text-ink-soft">
          <Link href={`${prefix}/privacy`} className="hover:text-ink">
            {messages.links.privacy}
          </Link>
          <Link href={`${prefix}/terms`} className="hover:text-ink">
            {messages.links.terms}
          </Link>
          <a href={`mailto:${contactEmail}`} className="hover:text-ink">
            {messages.links.contact}
          </a>
          <LanguageSwitcher currentLocale={locale} label={messages.switchLanguage} />
        </nav>
      </div>
      <div className="max-w-content mx-auto px-6 pb-6">
        <p className="font-body text-xs text-ink-soft/60">{messages.copyright}</p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Verify typecheck**

```
cd apps/web && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```
git add apps/web/components/LanguageSwitcher.tsx apps/web/components/Footer.tsx
git commit -m "feat(web): add Footer with language switcher and contact link"
```

---

### Task 11: Hero, ValueStrip, Features, HowItWorks, LanguagesStrip sections

**Files:**

- Create: `apps/web/components/Hero.tsx`
- Create: `apps/web/components/ValueStrip.tsx`
- Create: `apps/web/components/Features.tsx`
- Create: `apps/web/components/HowItWorks.tsx`
- Create: `apps/web/components/LanguagesStrip.tsx`

- [ ] **Step 1: Implement Hero**

`apps/web/components/Hero.tsx`:

```tsx
import Image from "next/image";
import { PhoneFrame } from "./PhoneFrame";
import { DownloadCTA } from "./DownloadCTA";
import type { Messages } from "@/lib/i18n";

interface HeroProps {
  messages: Messages["hero"];
}

export async function Hero({ messages }: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-sunrise">
      <div className="absolute inset-0 bg-warmth pointer-events-none" />
      <div className="relative max-w-content mx-auto px-6 py-16 md:py-24 grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
        <div className="space-y-6">
          <p className="font-body text-xs uppercase tracking-[0.18em] text-accent-deep">
            {messages.eyebrow}
          </p>
          <h1 className="font-display text-5xl md:text-6xl leading-[1.05] text-ink">
            {messages.headline}
            <br />
            <span className="text-accent">{messages.headlineAccent}</span>
          </h1>
          <p className="font-body text-lg text-ink-soft max-w-md">
            {messages.subheadline}
          </p>
          {/* @ts-expect-error: async server component */}
          <DownloadCTA messages={messages} variant="hero" />
        </div>
        <div className="relative flex justify-center items-center">
          <div className="flex gap-4 items-end">
            <PhoneFrame
              src="/screens/home.png"
              alt="Home screen"
              widthClass="w-[200px]"
              rotate={-4}
              priority
            />
            <PhoneFrame
              src="/screens/practice.png"
              alt="Practice screen"
              widthClass="w-[240px]"
              priority
            />
            <PhoneFrame
              src="/screens/progress.png"
              alt="Progress screen"
              widthClass="w-[200px]"
              rotate={4}
              priority
            />
          </div>
          <Image
            src="/character.png"
            alt=""
            width={120}
            height={120}
            className="absolute -bottom-4 -left-6 select-none pointer-events-none"
          />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Implement ValueStrip**

`apps/web/components/ValueStrip.tsx`:

```tsx
import type { Messages } from "@/lib/i18n";

interface Props {
  messages: Messages["valueStrip"];
}

const ICONS = ["💬", "🌐", "⚡", "🗓️"];

export function ValueStrip({ messages }: Props) {
  const items = [messages.v1, messages.v2, messages.v3, messages.v4];
  return (
    <section className="border-y border-ink/10 bg-white">
      <div className="max-w-content mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((item, i) => (
          <div key={item} className="flex items-center gap-3 justify-center">
            <span className="text-xl" aria-hidden>
              {ICONS[i]}
            </span>
            <span className="font-body text-sm font-medium text-ink-soft">{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Implement Features**

`apps/web/components/Features.tsx`:

```tsx
import { PhoneFrame } from "./PhoneFrame";
import type { Messages } from "@/lib/i18n";

interface Props {
  messages: Messages["features"];
}

const SCREENS: Array<{ src: string; alt: string }> = [
  { src: "/screens/practice.png", alt: "Practice screen showing live conversation" },
  { src: "/screens/practice.png", alt: "Correction screen" },
  { src: "/screens/home.png", alt: "Home screen showing daily practice" },
];

export function Features({ messages }: Props) {
  const cards = [messages.f1, messages.f2, messages.f3];
  return (
    <section className="py-section-y bg-cream">
      <div className="max-w-content mx-auto px-6 space-y-12">
        <h2 className="font-display text-3xl md:text-4xl text-ink text-center">
          {messages.title}
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {cards.map((card, i) => (
            <article
              key={card.title}
              className="flex flex-col items-center text-center gap-4"
            >
              <PhoneFrame
                src={SCREENS[i].src}
                alt={SCREENS[i].alt}
                widthClass="w-[200px]"
              />
              <h3 className="font-display text-xl text-ink">{card.title}</h3>
              <p className="font-body text-base text-ink-soft max-w-xs">{card.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Implement HowItWorks**

`apps/web/components/HowItWorks.tsx`:

```tsx
import type { Messages } from "@/lib/i18n";

interface Props {
  messages: Messages["howItWorks"];
}

export function HowItWorks({ messages }: Props) {
  const steps = [messages.s1, messages.s2, messages.s3];
  return (
    <section className="py-section-y bg-white">
      <div className="max-w-content mx-auto px-6 space-y-12">
        <h2 className="font-display text-3xl md:text-4xl text-ink text-center">
          {messages.title}
        </h2>
        <ol className="grid md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <li key={step.n} className="flex flex-col items-center text-center gap-3">
              <span className="inline-flex items-center justify-center h-12 w-12 rounded-pill bg-accent text-cream font-display text-xl">
                {step.n}
              </span>
              <h3 className="font-display text-xl text-ink">{step.title}</h3>
              <p className="font-body text-base text-ink-soft max-w-xs">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Implement LanguagesStrip**

`apps/web/components/LanguagesStrip.tsx`:

```tsx
import type { Messages } from "@/lib/i18n";

interface Props {
  messages: Messages["languages"];
}

const LANGUAGES: Array<{ flag: string; name: string }> = [
  { flag: "🇫🇷", name: "Français" },
  { flag: "🇩🇪", name: "Deutsch" },
  { flag: "🇮🇹", name: "Italiano" },
  { flag: "🇹🇷", name: "Türkçe" },
];

export function LanguagesStrip({ messages }: Props) {
  return (
    <section className="py-section-y bg-cream">
      <div className="max-w-content mx-auto px-6 space-y-8 text-center">
        <h2 className="font-display text-3xl md:text-4xl text-ink">{messages.title}</h2>
        <div className="flex flex-wrap justify-center gap-3">
          {LANGUAGES.map((l) => (
            <span
              key={l.name}
              className="inline-flex items-center gap-2 rounded-pill bg-white border border-ink/10 px-4 py-2 font-body text-sm text-ink shadow-card"
            >
              <span className="text-lg" aria-hidden>
                {l.flag}
              </span>
              {l.name}
            </span>
          ))}
          <span className="inline-flex items-center rounded-pill bg-ink/5 px-4 py-2 font-body text-sm text-ink-soft italic">
            {messages.more}
          </span>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Verify typecheck**

```
cd apps/web && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```
git add apps/web/components/Hero.tsx apps/web/components/ValueStrip.tsx apps/web/components/Features.tsx apps/web/components/HowItWorks.tsx apps/web/components/LanguagesStrip.tsx
git commit -m "feat(web): add Hero, ValueStrip, Features, HowItWorks, LanguagesStrip sections"
```

---

### Task 12: ScrollDepthTracker (client-side analytics)

**Files:**

- Create: `apps/web/components/ScrollDepthTracker.tsx`

- [ ] **Step 1: Implement ScrollDepthTracker**

`apps/web/components/ScrollDepthTracker.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";

export function ScrollDepthTracker() {
  useEffect(() => {
    let fired50 = false;
    let fired100 = false;

    const onScroll = () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const ratio = window.scrollY / docHeight;

      if (!fired50 && ratio >= 0.5) {
        fired50 = true;
        track("scroll_depth_50");
      }
      if (!fired100 && ratio >= 0.98) {
        fired100 = true;
        track("scroll_depth_100");
        window.removeEventListener("scroll", onScroll);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return null;
}
```

- [ ] **Step 2: Verify typecheck**

```
cd apps/web && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```
git add apps/web/components/ScrollDepthTracker.tsx
git commit -m "feat(web): add ScrollDepthTracker for 50%/100% scroll-depth events"
```

---

### Task 13: Root layout with fonts, analytics, and hreflang

**Files:**

- Create: `apps/web/app/layout.tsx`

- [ ] **Step 1: Implement layout**

`apps/web/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Fraunces, DM_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mylanguagecoach.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "My Language Coach — Practice languages. Build confidence.",
  description:
    "Your AI conversation partner. Talk to it, get instant corrections, and become fluent in any language — anywhere.",
  alternates: {
    canonical: "/",
    languages: {
      en: "/",
      fr: "/fr",
      "x-default": "/",
    },
  },
  openGraph: {
    type: "website",
    title: "My Language Coach",
    description: "Practice languages. Build confidence.",
    url: "/",
    siteName: "My Language Coach",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "My Language Coach",
    description: "Practice languages. Build confidence.",
    images: ["/og-image.png"],
  },
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${dmSans.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```
cd apps/web && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```
git add apps/web/app/layout.tsx
git commit -m "feat(web): add root layout with fonts, analytics, OG, and hreflang metadata"
```

---

### Task 14: EN landing page

**Files:**

- Create: `apps/web/app/page.tsx`

- [ ] **Step 1: Implement EN landing page**

`apps/web/app/page.tsx`:

```tsx
import { Hero } from "@/components/Hero";
import { ValueStrip } from "@/components/ValueStrip";
import { Features } from "@/components/Features";
import { HowItWorks } from "@/components/HowItWorks";
import { LanguagesStrip } from "@/components/LanguagesStrip";
import { DownloadCTA } from "@/components/DownloadCTA";
import { Footer } from "@/components/Footer";
import { ScrollDepthTracker } from "@/components/ScrollDepthTracker";
import { getMessages } from "@/lib/i18n";

export default async function HomePage() {
  const m = getMessages("en");
  return (
    <main>
      <ScrollDepthTracker />
      {/* @ts-expect-error: async server component */}
      <Hero messages={m.hero} />
      <ValueStrip messages={m.valueStrip} />
      <Features messages={m.features} />
      <HowItWorks messages={m.howItWorks} />
      <LanguagesStrip messages={m.languages} />
      <FinalCta
        title={m.finalCta.title}
        subtitle={m.finalCta.subtitle}
        heroMessages={m.hero}
      />
      <Footer messages={m.footer} locale="en" />
    </main>
  );
}

async function FinalCta({
  title,
  subtitle,
  heroMessages,
}: {
  title: string;
  subtitle: string;
  heroMessages: ReturnType<typeof getMessages>["hero"];
}) {
  return (
    <section className="py-section-y bg-sunrise">
      <div className="max-w-content mx-auto px-6 text-center space-y-8">
        <h2 className="font-display text-3xl md:text-4xl text-ink">{title}</h2>
        <p className="font-body text-lg text-ink-soft max-w-xl mx-auto">{subtitle}</p>
        <div className="flex justify-center">
          {/* @ts-expect-error: async server component */}
          <DownloadCTA messages={heroMessages} variant="final" />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run dev server and smoke-test**

```
cd apps/web && pnpm dev
```

Open http://localhost:3002. Expected:

- Page loads without errors in the browser console.
- Hero shows headline, sub-headline, phone screens placeholder (broken image OK at this stage — assets come in Task 17), and either QR codes (desktop) or store buttons (mobile).
- Resizing viewport across the `lg` breakpoint (1024px) swaps QR/buttons.

Stop the dev server with Ctrl+C when done.

- [ ] **Step 3: Verify typecheck and build**

```
cd apps/web && pnpm typecheck && pnpm build
```

Expected: PASS for both. Build output shows `/` as a static route.

- [ ] **Step 4: Commit**

```
git add apps/web/app/page.tsx
git commit -m "feat(web): assemble EN landing page"
```

---

### Task 15: FR landing page

**Files:**

- Create: `apps/web/app/fr/page.tsx`

- [ ] **Step 1: Implement FR landing page**

`apps/web/app/fr/page.tsx`:

```tsx
import { Hero } from "@/components/Hero";
import { ValueStrip } from "@/components/ValueStrip";
import { Features } from "@/components/Features";
import { HowItWorks } from "@/components/HowItWorks";
import { LanguagesStrip } from "@/components/LanguagesStrip";
import { DownloadCTA } from "@/components/DownloadCTA";
import { Footer } from "@/components/Footer";
import { ScrollDepthTracker } from "@/components/ScrollDepthTracker";
import { getMessages } from "@/lib/i18n";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Language Coach — Pratiquez les langues. Gagnez en confiance.",
  description:
    "Votre partenaire de conversation alimenté par l'IA. Parlez-lui, recevez des corrections instantanées, et devenez fluide dans n'importe quelle langue.",
  alternates: {
    canonical: "/fr",
    languages: { en: "/", fr: "/fr", "x-default": "/" },
  },
};

export default async function FrenchHomePage() {
  const m = getMessages("fr");
  return (
    <main>
      <ScrollDepthTracker />
      {/* @ts-expect-error: async server component */}
      <Hero messages={m.hero} />
      <ValueStrip messages={m.valueStrip} />
      <Features messages={m.features} />
      <HowItWorks messages={m.howItWorks} />
      <LanguagesStrip messages={m.languages} />
      <FinalCta
        title={m.finalCta.title}
        subtitle={m.finalCta.subtitle}
        heroMessages={m.hero}
      />
      <Footer messages={m.footer} locale="fr" />
    </main>
  );
}

async function FinalCta({
  title,
  subtitle,
  heroMessages,
}: {
  title: string;
  subtitle: string;
  heroMessages: ReturnType<typeof getMessages>["hero"];
}) {
  return (
    <section className="py-section-y bg-sunrise">
      <div className="max-w-content mx-auto px-6 text-center space-y-8">
        <h2 className="font-display text-3xl md:text-4xl text-ink">{title}</h2>
        <p className="font-body text-lg text-ink-soft max-w-xl mx-auto">{subtitle}</p>
        <div className="flex justify-center">
          {/* @ts-expect-error: async server component */}
          <DownloadCTA messages={heroMessages} variant="final" />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Smoke-test /fr**

```
cd apps/web && pnpm dev
```

Open http://localhost:3002/fr. Expected:

- Page loads, all visible strings are in French.
- Footer language switcher swaps to `/` when clicked.
- `<html lang="en">` is shown — that's intentional and will be addressed in Task 21 (per-route html lang via `generateMetadata` is constrained in App Router; we set `lang` via the root layout. The `<link rel="alternate" hreflang>` tags are what actually signal locale to search engines, and those are already set in metadata).

Stop dev server.

- [ ] **Step 3: Verify build**

```
cd apps/web && pnpm build
```

Expected: PASS. Build output shows `/fr` as a static route.

- [ ] **Step 4: Commit**

```
git add apps/web/app/fr/page.tsx
git commit -m "feat(web): add FR landing page at /fr"
```

---

### Task 16: Privacy + Terms pages (EN + FR, MDX content)

**Files:**

- Create: `apps/web/content/privacy.en.mdx`
- Create: `apps/web/content/privacy.fr.mdx`
- Create: `apps/web/content/terms.en.mdx`
- Create: `apps/web/content/terms.fr.mdx`
- Create: `apps/web/app/privacy/page.tsx`
- Create: `apps/web/app/terms/page.tsx`
- Create: `apps/web/app/fr/privacy/page.tsx`
- Create: `apps/web/app/fr/terms/page.tsx`
- Create: `apps/web/components/LegalLayout.tsx`

- [ ] **Step 1: Create privacy.en.mdx**

`apps/web/content/privacy.en.mdx`:

```mdx
**Last updated: 2026-05-27**

> This document is a draft. Final legal review pending before production app submission.

# Privacy Policy

My Language Coach ("we", "the app") is operated by Bruno Moïse as a personal project, currently in open beta.

## What we collect

- **Account data:** email address (required for sign-in via Supabase).
- **Practice activity:** session start/end times, language practiced, duration, conversation transcripts.
- **Voice audio:** when you speak in the app, audio is transmitted to OpenAI for transcription. Audio is not retained on our servers after transcription.
- **Device identifiers:** a generated device ID stored locally on your device for cross-session continuity.

## Third parties

- **Supabase** — authentication and database.
- **OpenAI** — voice transcription (Whisper) and conversational AI (GPT-4o).
- **Google Cloud Text-to-Speech** — generates the coach's spoken replies.
- **Vercel Web Analytics** — anonymous page-view counts on this website. No cookies, no personal data.

## Data retention

Account data is retained until you delete your account from the app's profile screen. Practice activity is retained for as long as your account exists. Voice audio is processed in real time and not stored.

## Your rights

You can delete your account at any time from the app. On request to the contact email below, we can also export or permanently delete your data.

## Contact

Privacy questions: <a href="mailto:bruno.a.moise@gmail.com">bruno.a.moise@gmail.com</a>
```

- [ ] **Step 2: Create privacy.fr.mdx**

`apps/web/content/privacy.fr.mdx`:

```mdx
**Dernière mise à jour : 2026-05-27**

> Ce document est une ébauche. Révision juridique finale en attente avant la soumission de l'application en production.

# Politique de confidentialité

My Language Coach (« nous », « l'application ») est exploitée par Bruno Moïse en tant que projet personnel, actuellement en bêta ouverte.

## Données collectées

- **Données de compte :** adresse e-mail (requise pour la connexion via Supabase).
- **Activité de pratique :** horodatages de début/fin de session, langue pratiquée, durée, transcriptions de conversation.
- **Audio vocal :** lorsque vous parlez dans l'application, l'audio est transmis à OpenAI pour transcription. L'audio n'est pas conservé sur nos serveurs après transcription.
- **Identifiants d'appareil :** un identifiant généré, stocké localement sur votre appareil pour la continuité entre sessions.

## Tiers

- **Supabase** — authentification et base de données.
- **OpenAI** — transcription vocale (Whisper) et IA conversationnelle (GPT-4o).
- **Google Cloud Text-to-Speech** — génère les réponses vocales du coach.
- **Vercel Web Analytics** — comptage anonyme des pages vues sur ce site. Aucun cookie, aucune donnée personnelle.

## Conservation des données

Les données de compte sont conservées jusqu'à la suppression de votre compte depuis l'écran de profil de l'application. L'activité de pratique est conservée tant que votre compte existe. L'audio vocal est traité en temps réel et n'est pas stocké.

## Vos droits

Vous pouvez supprimer votre compte à tout moment depuis l'application. Sur demande à l'e-mail de contact ci-dessous, nous pouvons également exporter ou supprimer définitivement vos données.

## Contact

Questions de confidentialité : <a href="mailto:bruno.a.moise@gmail.com">bruno.a.moise@gmail.com</a>
```

- [ ] **Step 3: Create terms.en.mdx**

`apps/web/content/terms.en.mdx`:

```mdx
**Last updated: 2026-05-27**

> This document is a draft. Final legal review pending before production app submission.

# Terms of Service

By using My Language Coach (the "Service"), you agree to these terms.

## Beta service

The Service is currently provided free of charge as an open beta. Features, availability, and pricing may change without notice. The Service is provided "as is" with no warranty of any kind.

## Acceptable use

You agree not to: misuse the Service to harass, defame, or harm others; attempt to reverse-engineer, break into, or disrupt the Service; or submit content that violates applicable laws.

## Account termination

We reserve the right to suspend or terminate accounts that violate these terms. You may delete your own account at any time from the app's profile screen.

## Limitation of liability

To the maximum extent permitted by law, we are not liable for indirect, incidental, or consequential damages arising from your use of the Service.

## Changes to these terms

We may update these terms; the "Last updated" date at the top will reflect any changes. Continued use of the Service constitutes acceptance of the updated terms.

## Contact

Questions: <a href="mailto:bruno.a.moise@gmail.com">bruno.a.moise@gmail.com</a>
```

- [ ] **Step 4: Create terms.fr.mdx**

`apps/web/content/terms.fr.mdx`:

```mdx
**Dernière mise à jour : 2026-05-27**

> Ce document est une ébauche. Révision juridique finale en attente avant la soumission de l'application en production.

# Conditions d'utilisation

En utilisant My Language Coach (le « Service »), vous acceptez ces conditions.

## Service en bêta

Le Service est actuellement fourni gratuitement en bêta ouverte. Les fonctionnalités, la disponibilité et la tarification peuvent changer sans préavis. Le Service est fourni « tel quel » sans garantie d'aucune sorte.

## Utilisation acceptable

Vous vous engagez à ne pas : utiliser le Service à mauvais escient pour harceler, diffamer ou nuire à autrui ; tenter d'analyser le code, de s'introduire ou de perturber le Service ; ou soumettre un contenu enfreignant les lois applicables.

## Résiliation de compte

Nous nous réservons le droit de suspendre ou de résilier les comptes qui enfreignent ces conditions. Vous pouvez supprimer votre propre compte à tout moment depuis l'écran de profil de l'application.

## Limitation de responsabilité

Dans la mesure maximale permise par la loi, nous ne sommes pas responsables des dommages indirects, accessoires ou consécutifs découlant de votre utilisation du Service.

## Modifications des conditions

Nous pouvons mettre à jour ces conditions ; la date « Dernière mise à jour » en haut reflétera les changements. L'utilisation continue du Service constitue une acceptation des conditions mises à jour.

## Contact

Questions : <a href="mailto:bruno.a.moise@gmail.com">bruno.a.moise@gmail.com</a>
```

- [ ] **Step 5: Create LegalLayout**

`apps/web/components/LegalLayout.tsx`:

```tsx
import { Footer } from "./Footer";
import { getMessages, type Locale } from "@/lib/i18n";

interface Props {
  locale: Locale;
  children: React.ReactNode;
}

export function LegalLayout({ locale, children }: Props) {
  const m = getMessages(locale);
  return (
    <>
      <main className="max-w-content mx-auto px-6 py-16">
        <article className="prose prose-ink mx-auto max-w-2xl">{children}</article>
      </main>
      <Footer messages={m.footer} locale={locale} />
    </>
  );
}
```

- [ ] **Step 6: Install Tailwind typography plugin**

```
cd apps/web && pnpm add -D @tailwindcss/typography
```

Then update `apps/web/tailwind.config.ts` to add the plugin:

```ts
import typography from "@tailwindcss/typography";

// Inside the `const config: Config = { ... }`, change `plugins: []` to:
plugins: [typography],
```

- [ ] **Step 7: Create the four page files**

`apps/web/app/privacy/page.tsx`:

```tsx
import { LegalLayout } from "@/components/LegalLayout";
import Content from "@/content/privacy.en.mdx";

export const metadata = {
  title: "Privacy Policy — My Language Coach",
  alternates: { canonical: "/privacy", languages: { en: "/privacy", fr: "/fr/privacy" } },
};

export default function Page() {
  return (
    <LegalLayout locale="en">
      <Content />
    </LegalLayout>
  );
}
```

`apps/web/app/terms/page.tsx`:

```tsx
import { LegalLayout } from "@/components/LegalLayout";
import Content from "@/content/terms.en.mdx";

export const metadata = {
  title: "Terms of Service — My Language Coach",
  alternates: { canonical: "/terms", languages: { en: "/terms", fr: "/fr/terms" } },
};

export default function Page() {
  return (
    <LegalLayout locale="en">
      <Content />
    </LegalLayout>
  );
}
```

`apps/web/app/fr/privacy/page.tsx`:

```tsx
import { LegalLayout } from "@/components/LegalLayout";
import Content from "@/content/privacy.fr.mdx";

export const metadata = {
  title: "Politique de confidentialité — My Language Coach",
  alternates: { canonical: "/fr/privacy", languages: { en: "/privacy", fr: "/fr/privacy" } },
};

export default function Page() {
  return (
    <LegalLayout locale="fr">
      <Content />
    </LegalLayout>
  );
}
```

`apps/web/app/fr/terms/page.tsx`:

```tsx
import { LegalLayout } from "@/components/LegalLayout";
import Content from "@/content/terms.fr.mdx";

export const metadata = {
  title: "Conditions d'utilisation — My Language Coach",
  alternates: { canonical: "/fr/terms", languages: { en: "/terms", fr: "/fr/terms" } },
};

export default function Page() {
  return (
    <LegalLayout locale="fr">
      <Content />
    </LegalLayout>
  );
}
```

- [ ] **Step 8: Create mdx-components.tsx (required by @next/mdx)**

`apps/web/mdx-components.tsx`:

```tsx
import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return components;
}
```

- [ ] **Step 9: Verify typecheck + build**

```
cd apps/web && pnpm typecheck && pnpm build
```

Expected: PASS. Build output shows all four legal routes as static.

- [ ] **Step 10: Smoke-test**

```
cd apps/web && pnpm dev
```

Open http://localhost:3002/privacy, /terms, /fr/privacy, /fr/terms. Each renders the content from the corresponding MDX file with the footer below. Stop dev server.

- [ ] **Step 11: Commit**

```
git add apps/web/content/ apps/web/app/privacy apps/web/app/terms apps/web/app/fr/privacy apps/web/app/fr/terms apps/web/components/LegalLayout.tsx apps/web/mdx-components.tsx apps/web/tailwind.config.ts apps/web/package.json
git commit -m "feat(web): add /privacy and /terms pages (EN + FR) with MDX content"
```

---

### Task 17: Capture assets — screenshots, character, favicon, OG image

**Note:** This task is mostly manual — image capture from the running mobile app. No tests. Commit each asset as it's added.

**Files:**

- Create: `apps/web/public/screens/home.png`
- Create: `apps/web/public/screens/practice.png`
- Create: `apps/web/public/screens/progress.png`
- Create: `apps/web/public/character.png`
- Create: `apps/web/public/favicon.ico`
- Create: `apps/web/public/og-image.png`

- [ ] **Step 1: Capture phone screenshots from the running mobile dev build**

The mobile dev build is already installed on Bruno's Android device (per CLAUDE.md). Either:

**Option A (faster):** ask Bruno to capture three full-screen screenshots on the Android device (Home tab, Practice tab mid-conversation, Progress tab showing streak data) and drop them into `apps/web/public/screens/` as `home.png`, `practice.png`, `progress.png`. PNG at the device's native resolution is fine — Next.js Image will resize.

**Option B (if Bruno is unavailable):** start the Expo iOS simulator (`cd apps/mobile && pnpm ios`), navigate to each tab, and take screenshots via `Cmd+S` (saves to Desktop), then rename and move into `apps/web/public/screens/`. Note: macOS only.

Whichever path, the three files must exist before continuing.

- [ ] **Step 2: Export character PNG from Lottie**

The character is in `apps/mobile/assets/avatar.json` (Lottie file). Two paths:

**Option A (recommended):** find an existing static rendering — if Bruno's marketing image (`ChatGPT Image 27 mai 2026, 15_20_15.png`) shows the character, crop her out and use that. Save the cropped PNG at roughly 240×240 with transparent background to `apps/web/public/character.png`.

**Option B:** install `puppeteer-lottie-cli` or use lottiefiles.com's "render to image" tool to export a frame of `avatar.json` to PNG.

- [ ] **Step 3: Generate favicon**

Source: `apps/mobile/assets/icon.png`. Tools:

- Online: [realfavicongenerator.net](https://realfavicongenerator.net) — upload icon.png, download the favicon set, save `favicon.ico` to `apps/web/public/`.
- Local: `pnpm dlx png-to-ico apps/mobile/assets/icon.png > apps/web/public/favicon.ico`

- [ ] **Step 4: Generate Open Graph image (1200×630)**

Bruno's marketing image is already a good starting point. Open it in any editor (Figma, Photoshop, or even macOS Preview), resize/crop to 1200×630, and save as `apps/web/public/og-image.png`. PNG, ≤ 1 MB.

If easier, create a fresh OG image: cream background, "My Language Coach" + "Practice languages. Build confidence." in Fraunces, the character on the right. Aim for 1200×630.

- [ ] **Step 5: Re-run dev server and verify all images load**

```
cd apps/web && pnpm dev
```

Open http://localhost:3002 — the hero should now show real phone screens + the character. No broken-image icons. Check `/og-image.png` loads when typed directly. Check the favicon shows in the browser tab.

- [ ] **Step 6: Commit assets**

```
git add apps/web/public/
git commit -m "feat(web): add phone screenshots, character, favicon, and OG image"
```

---

### Task 18: README for apps/web (with TestFlight expiry note)

**Files:**

- Create: `apps/web/README.md`

- [ ] **Step 1: Write the README**

`apps/web/README.md`:

````md
# @language-coach/web

Marketing landing page for My Language Coach. EN at `/`, FR at `/fr`.

## Local development

```sh
pnpm install         # from monorepo root
pnpm dev             # from apps/web/
# → http://localhost:3002
```

Copy `.env.example` to `.env.local` and adjust if you want to point at different store URLs locally.

## Tests

```sh
pnpm test            # lib unit tests (store-links, ua-detect, qr, i18n)
pnpm typecheck       # TypeScript strict
pnpm build           # production build
```

There are no component tests — sections are verified by manual smoke and Lighthouse.

## Environment variables

| Name                          | Purpose                                                         |
| ----------------------------- | --------------------------------------------------------------- |
| `NEXT_PUBLIC_IOS_URL`         | iOS install URL (TestFlight join URL, later App Store URL).     |
| `NEXT_PUBLIC_ANDROID_URL`     | Android install URL (Play Store details URL).                   |
| `NEXT_PUBLIC_CONTACT_EMAIL`   | Footer "Contact" link.                                          |
| `NEXT_PUBLIC_SITE_URL`        | Used as `metadataBase` for absolute OG/canonical URLs.          |

All four have safe defaults in code, so local dev works without `.env.local`.

## ⚠️ TestFlight public link expires every ~90 days

The iOS URL points to a TestFlight public-test join link. **These expire after 90 days and cap at 10,000 testers.** When the link breaks:

1. Generate a new public-test URL in App Store Connect → TestFlight → External Testing.
2. Update `NEXT_PUBLIC_IOS_URL` in the Vercel project's Environment Variables (Production + Preview).
3. Redeploy (Vercel does this automatically on env-var change).

Total: ~5 minutes. No code change needed.

## Production deployment

Auto-deployed to Vercel from `main`. PR branches get preview deploys.

Custom domain: `mylanguagecoach.app`, purchased on Porkbun, pointed at Vercel's DNS.

## Architecture

See `docs/superpowers/specs/2026-05-27-landing-page-design.md` (spec) and `docs/superpowers/plans/2026-05-27-landing-page.md` (this plan's history).
````

- [ ] **Step 2: Commit**

```
git add apps/web/README.md
git commit -m "docs(web): add README with dev workflow and TestFlight expiry note"
```

---

### Task 19: vercel.json for monorepo deploy

**Files:**

- Create: `apps/web/vercel.json`

- [ ] **Step 1: Write vercel.json**

`apps/web/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "cd ../.. && pnpm turbo run build --filter=@language-coach/web",
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

- [ ] **Step 2: Commit**

```
git add apps/web/vercel.json
git commit -m "chore(web): add vercel.json for monorepo-aware build"
```

---

### Task 20: Final full-stack verification

**Files:** none.

- [ ] **Step 1: Run all monorepo checks from root**

```
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app" && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

Expected: all PASS. If `lint` or `typecheck` fails for `apps/web/`, fix before continuing.

- [ ] **Step 2: Run Lighthouse on the local build**

```
cd apps/web && pnpm build && pnpm start
```

In another shell:

```
pnpm dlx @lhci/cli@latest autorun --collect.url=http://localhost:3002 --collect.url=http://localhost:3002/fr --upload.target=temporary-public-storage
```

Or run Lighthouse from Chrome DevTools. Expected: Performance ≥ 90, Accessibility ≥ 95 on both URLs. If accessibility drops, the most likely cause is a missing `alt` text or a color-contrast issue on the sunrise gradient — both fixable.

Stop the server with Ctrl+C.

- [ ] **Step 3: Smoke-test the UA matrix**

Start dev server (`pnpm dev`). Open Chrome DevTools → Toggle device toolbar → switch between iPhone, Pixel, and desktop. For each:

- **iPhone (≤1024px width, iOS UA):** only iOS button visible, no QR codes, no Android button.
- **Pixel (≤1024px width, Android UA):** only Android button visible.
- **Desktop:** both QR codes visible, no buttons.

If any fails, recheck `DownloadCTA.client.tsx` and the responsive CSS.

- [ ] **Step 4: Verify QR codes encode the right URLs**

In the desktop view, screenshot each QR code, then scan with a phone (or use https://zxing.org/w/decode). The decoded URLs should match the values in `.env.local` (or the defaults if no env override).

- [ ] **Step 5: Verify language switcher preserves path**

From `/privacy` click the FR switcher → land on `/fr/privacy`. From `/fr/terms` click the EN switcher → land on `/terms`. From `/` click FR → `/fr`. From `/fr` click EN → `/`.

- [ ] **Step 6: Commit verification log (no code changes)**

If everything passed, no commit needed. If any small fixes were required, commit them with appropriate `fix(web): ...` messages.

---

### Task 21: Vercel project setup (manual, Bruno-driven)

**This task is not code — it's a checklist Bruno follows in the Vercel dashboard. Listed here so the deploy is reproducible.**

- [ ] **Step 1: Push the feature branch**

```
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app" && git push -u origin feat/landing-page
```

- [ ] **Step 2: Open a PR**

```
gh pr create --title "feat(web): marketing landing page (EN + FR)" --body "$(cat <<'EOF'
## Summary

- New `apps/web/` Next.js app for the public marketing landing page
- EN at `/`, FR at `/fr`
- Smart DownloadCTA: QR codes on desktop, store buttons on mobile
- `/privacy` and `/terms` (EN + FR) with placeholder legal content
- Vercel Web Analytics + 4 custom events

Spec: `docs/superpowers/specs/2026-05-27-landing-page-design.md`
Plan: `docs/superpowers/plans/2026-05-27-landing-page.md`

## Test plan

- [ ] CI typecheck/lint/test/build all green
- [ ] Vercel preview deploy shows `/` and `/fr` rendering correctly
- [ ] Scanning QR on preview deploy opens correct stores
- [ ] Mobile preview URLs show only the right OS's button
- [ ] Lighthouse Performance ≥ 90, Accessibility ≥ 95
EOF
)"
```

- [ ] **Step 3: In Vercel dashboard — create new project**

1. Visit https://vercel.com/new
2. "Import Git Repository" → select `bruno77176/my-language-coach-agentical-rebuild`
3. Project name: `language-coach-web`
4. **Root Directory:** `apps/web`
5. Framework Preset: Next.js (auto-detected)
6. Build command: leave default (`vercel.json` overrides)
7. Install command: leave default (`vercel.json` overrides)
8. Click Deploy

- [ ] **Step 4: Set environment variables**

In Vercel project → Settings → Environment Variables, add three vars for **Production** and **Preview**:

```
NEXT_PUBLIC_IOS_URL = https://testflight.apple.com/join/yU7XNGSS
NEXT_PUBLIC_ANDROID_URL = https://play.google.com/store/apps/details?id=com.anonymous.mylanguagecoach
NEXT_PUBLIC_CONTACT_EMAIL = bruno.a.moise@gmail.com
NEXT_PUBLIC_SITE_URL = https://language-coach-web.vercel.app   (update to mylanguagecoach.app after domain is attached)
```

Trigger a redeploy after setting them.

- [ ] **Step 5: Enable Vercel Web Analytics**

In project → Analytics tab → click "Enable Web Analytics". No code change needed; the `<Analytics />` component already added in Task 13 picks it up.

- [ ] **Step 6: Smoke-test the deploy**

Visit `https://language-coach-web.vercel.app`. Verify the full UA matrix smoke-test from Task 20 Step 3 works on the live deploy. Scan a QR code from your phone — confirms QR encoding survived the production build.

- [ ] **Step 7 (whenever ready): Attach mylanguagecoach.app domain**

1. Buy `mylanguagecoach.app` on Porkbun (~$15/yr flat).
2. In Vercel → project → Settings → Domains → Add → enter `mylanguagecoach.app`.
3. Vercel returns DNS records (typically `CNAME @ → cname.vercel-dns.com` or two A records).
4. In Porkbun → DNS for the domain → paste the records.
5. Wait 5-15 min for DNS propagation. Vercel auto-provisions SSL.
6. Update `NEXT_PUBLIC_SITE_URL` env var to `https://mylanguagecoach.app` and redeploy.

---

## Post-merge cleanup

- [ ] **Merge the PR via GitHub UI** (squash-merge if that's the team convention; check past PRs).
- [ ] **Delete the `feat/landing-page` branch** locally and remote.
- [ ] **Update the project README at the monorepo root** to mention `apps/web` (and the live URL) alongside `apps/admin` and `apps/mobile`.
- [ ] **Add a calendar reminder** for ~2026-08-25 (90 days from today) to renew the TestFlight public link before it expires.

---

## Success criteria recap

(Copied from the spec's "Success criteria" section so the implementer doesn't have to flip back.)

- `apps/web/` builds cleanly via `turbo run build --filter=@language-coach/web` and via Vercel's CI.
- Deployed site loads with Lighthouse Performance ≥ 90 and Accessibility ≥ 95 on desktop.
- Scanning either QR code from a phone opens the correct store/TestFlight page.
- On iPhone: only iOS button (no QRs, no Android button). Same logic verified for Android.
- Switching to `/fr` swaps every visible string; switching back preserves the current path.
- `/privacy` and `/terms` return real content in both locales.
- Vercel Web Analytics dashboard shows page views and at least one custom event after smoke-testing.
