# Plan 6: Voice-loop legacy parity + per-sentence streaming TTS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Bruno explicitly authorized **autonomous parallel execution** — drop the formal review subagents (same as Plan 5 batches B-C) and trust the implementers; verify diffs inline. Trigger an EAS dev build at the very end.

**Goal:** Restore the legacy practice-session experience (timer, repeat, listening mode, daily-goal reward, greeting, silence detection) and halve perceived response latency via per-sentence streaming TTS.

**Architecture:** Backend gets a major refactor of the voice-turn SSE route (parallel per-sentence TTS, new `reply-chunk` event), one new route for greeting audio, one route extension for per-message audio, one new column. Mobile gets a hook + UI overhaul of the practice screen with new components (TopStatusBar, GoalReward) and a meaningful rewrite of `useConversation` to manage the audio queue, listening mode, and inline soft-error mapping.

**Tech Stack:** Hono on Bun (API), Drizzle/postgres-js (DB), Supabase Postgres + RLS + Storage, Expo SDK 54 + Expo Router (mobile), `@gorhom/bottom-sheet` (existing), `react-native-confetti-cannon` (new), Vitest for tests.

**Spec:** `docs/superpowers/specs/2026-05-10-plan-6-voice-loop-parity-design.md`

---

## File map

**Backend (new):**

- `apps/api/src/db/migrations/0006_messages_is_greeting.sql`
- `apps/api/src/lib/sentence-buffer.ts` + `.test.ts`
- `apps/api/src/routes/voice-greeting.ts` + `.test.ts`

**Backend (modify):**

- `apps/api/src/lib/storage.ts` — add `uploadCoachAudioChunk`, `uploadGreetingAudio`
- `apps/api/src/routes/messages.ts` — add `POST /:id/audio` endpoint
- `apps/api/src/routes/messages.test.ts` — tests for new endpoint
- `apps/api/src/routes/voice.ts` — refactor turn route for per-sentence streaming
- `apps/api/src/routes/voice-turn.test.ts` — replace text-delta + reply-audio assertions with reply-chunk
- `apps/api/src/app.ts` — wire greeting route
- `apps/api/src/db/schema/messages.ts` — add `isGreeting` column

**Shared (new):**

- `packages/shared/src/greetings.ts` + `.test.ts`
- `packages/shared/src/coach-fallbacks.ts` + `.test.ts`

**Shared (modify):**

- `packages/shared/src/index.ts` — re-exports

**Mobile (new):**

- `apps/mobile/src/features/practice/use-session-timer.ts`
- `apps/mobile/src/features/practice/use-goal-reward.ts`
- `apps/mobile/src/features/practice/top-status-bar.tsx`
- `apps/mobile/src/features/practice/goal-reward.tsx`
- `apps/mobile/src/features/practice/audio-queue.ts` + `.test.ts`
- `apps/mobile/src/features/practice/audio-rms.ts` + `.test.ts`
- `apps/mobile/src/features/practice/api-greeting.ts`
- `apps/mobile/src/features/practice/api-message-audio.ts`

**Mobile (modify):**

- `apps/mobile/src/lib/api-client.ts` — `TurnEvent` type changes (drop `reply-text-delta` + `reply-audio`, add `reply-chunk`)
- `apps/mobile/src/features/practice/use-conversation.ts` — biggest rewrite (greeting flow, chunk handling, listening mode, error mapping, RMS check, audio durations)
- `apps/mobile/src/features/practice/MessageBubble.tsx` — listening view + repeat icon
- `apps/mobile/src/features/practice/types.ts` — add `audioDurationMs`, `isGreeting`
- `apps/mobile/app/(tabs)/practice.tsx` — replace topBar with `<TopStatusBar />`, render `<GoalReward />` overlay
- `apps/mobile/package.json` — add `react-native-confetti-cannon`
- `apps/mobile/assets/sounds/victory.mp3` — copy from legacy

---

## Execution batches (autonomous parallel)

- **Sequential first**: Task 1 (install confetti dep + asset — modifies lockfile)
- **Batch A (8 in parallel)**: Tasks 2-9 (migration, pure modules, mobile foundation hooks/utils, types)
- **Sequential after A**: Task 10 (storage helper extension), Task 11 (greeting route), Task 12 (message audio route), Task 13 (voice route refactor), Task 14 (wire app.ts + push to deploy)
- **Batch B (3 in parallel after Phase 2)**: Tasks 15-17 (UI components: TopStatusBar, GoalReward, MessageBubble)
- **Sequential**: Task 18 (useConversation rewrite — keystone)
- **Sequential**: Task 19 (practice.tsx assembly)
- **Final**: Task 20 (EAS dev build trigger + memory + CLAUDE.md update)

---

## Phase 1 — Setup

### Task 1: Add confetti dep + victory sound

**Files:**

- Modify: `apps/mobile/package.json`, `pnpm-lock.yaml`
- Create: `apps/mobile/assets/sounds/victory.mp3` (copy from legacy)

- [ ] **Step 1: Copy the victory sound from legacy**

```bash
mkdir -p "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/mobile/assets/sounds"
cp "C:/Users/bruno.moise/My Language Coach - rebuild/my-language-coach/assets/sounds/victory.mp3" \
   "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/mobile/assets/sounds/victory.mp3"
```

- [ ] **Step 2: Install react-native-confetti-cannon**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/mobile"
npx expo install react-native-confetti-cannon
```

(Use `npx expo install` per Plan 5 lesson — it picks the SDK-compatible version.)

- [ ] **Step 3: Verify no duplicates introduced**

```bash
npx expo-doctor 2>&1 | tail -10
```

Expected: 16-17 of 17 checks pass. NO "duplicate" warnings. If duplicates appear, remove the offending real (non-symlink) directories from monorepo-root `node_modules`:

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app"
for d in node_modules/react-native-confetti-cannon; do
  if [ -d "$d" ] && [ ! -L "$d" ]; then rm -rf "$d"; fi
done
```

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app"
git add apps/mobile/package.json apps/mobile/assets/sounds/victory.mp3 pnpm-lock.yaml
git commit -m "feat(mobile): add react-native-confetti-cannon + legacy victory.mp3 (Plan 6)"
```

DO NOT push.

---

## Phase 2 — Foundation (parallel-safe)

### Task 2: SQL migration `0006_messages_is_greeting.sql`

**Files:**

- Create: `apps/api/src/db/migrations/0006_messages_is_greeting.sql`
- Modify: `apps/api/src/db/schema/messages.ts`
- Modify: `apps/api/src/db/verify-migrations.ts` (no functions to add, just the `EXPECTED_FUNCTIONS` list stays the same)

- [ ] **Step 1: Write SQL**

Create `apps/api/src/db/migrations/0006_messages_is_greeting.sql`:

```sql
-- Plan 6: flag greeting messages so we can exclude them from streak counting / analytics later.
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_greeting boolean NOT NULL DEFAULT false;
```

- [ ] **Step 2: Update Drizzle schema**

Open `apps/api/src/db/schema/messages.ts` and add the column. Find the `messages` table definition and add inside the column object:

```ts
isGreeting: boolean("is_greeting").notNull().default(false),
```

(`boolean` import from `drizzle-orm/pg-core` should already be present; add if not.)

- [ ] **Step 3: Apply migration**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/api"
pnpm tsx --env-file=.env src/db/run-migrations.ts
```

Expected: `APPLY 0006_messages_is_greeting.sql` then `Done. Applied 1 new migration(s).`

- [ ] **Step 4: Verify**

```bash
pnpm tsx --env-file=.env src/db/verify-migrations.ts 2>&1 | tail -5
```

Expected: still 5 functions, 10+ tables, no errors.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app"
git add apps/api/src/db/migrations/0006_messages_is_greeting.sql apps/api/src/db/schema/messages.ts
git commit -m "feat(api): add messages.is_greeting column (Plan 6)"
```

---

### Task 3: Sentence buffer (pure TS, TDD)

**Files:**

- Create: `apps/api/src/lib/sentence-buffer.ts`
- Create: `apps/api/src/lib/sentence-buffer.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/lib/sentence-buffer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SentenceBuffer } from "./sentence-buffer";

describe("SentenceBuffer", () => {
  it("emits a sentence when push completes one", () => {
    const buf = new SentenceBuffer();
    expect(buf.push("Hello.")).toEqual([]);
    expect(buf.push(" ")).toEqual(["Hello."]);
  });

  it("emits nothing for partial sentence", () => {
    const buf = new SentenceBuffer();
    expect(buf.push("Hello")).toEqual([]);
    expect(buf.push(" world")).toEqual([]);
  });

  it("emits multiple sentences in one push", () => {
    const buf = new SentenceBuffer();
    expect(buf.push("Hi! How are you? ")).toEqual(["Hi!", "How are you?"]);
  });

  it("handles question and exclamation marks", () => {
    const buf = new SentenceBuffer();
    expect(buf.push("What? ")).toEqual(["What?"]);
    expect(buf.push("Wow! ")).toEqual(["Wow!"]);
  });

  it("flush returns remaining buffer if non-empty", () => {
    const buf = new SentenceBuffer();
    buf.push("Hi there");
    expect(buf.flush()).toBe("Hi there");
    expect(buf.flush()).toBe("");
  });

  it("flush returns empty string when buffer was already drained", () => {
    const buf = new SentenceBuffer();
    buf.push("Hi. ");
    expect(buf.flush()).toBe("");
  });

  it("preserves multi-byte chars", () => {
    const buf = new SentenceBuffer();
    expect(buf.push("¿Cómo estás? ")).toEqual(["¿Cómo estás?"]);
  });
});
```

- [ ] **Step 2: Run tests, confirm failure**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/api"
pnpm test sentence-buffer
```

Expected: `Cannot find module './sentence-buffer'`.

- [ ] **Step 3: Implement**

Create `apps/api/src/lib/sentence-buffer.ts`:

```ts
/**
 * Streams text deltas in, emits complete sentences out.
 *
 * A sentence is anything terminated by `.`, `!`, or `?` followed by whitespace
 * (or end-of-stream when flush() is called). Multiple terminators in a row are
 * treated as one (e.g. "Wait...").
 *
 * Edge cases like "Mr. Smith" or "U.S.A." may produce extra splits — acceptable
 * cost for v1. The function is deterministic and fully tested.
 */
export class SentenceBuffer {
  private buffer = "";

  /** Append text. Returns any complete sentences that became available. */
  push(delta: string): string[] {
    this.buffer += delta;
    const sentences: string[] = [];

    // Match: anything up to a terminator sequence, followed by whitespace.
    // Capture the sentence (group 1) and then the whitespace.
    const re = /^([\s\S]*?[.!?]+)(\s+)/;

    while (true) {
      const m = this.buffer.match(re);
      if (!m) break;
      sentences.push(m[1].trim());
      this.buffer = this.buffer.slice(m[0].length);
    }

    return sentences;
  }

  /** Drain whatever is left in the buffer. Returns "" if already empty. */
  flush(): string {
    const remaining = this.buffer.trim();
    this.buffer = "";
    return remaining;
  }
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
pnpm test sentence-buffer
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app"
git add apps/api/src/lib/sentence-buffer.ts apps/api/src/lib/sentence-buffer.test.ts
git commit -m "feat(api): SentenceBuffer for streaming TTS chunking (Plan 6)"
```

---

### Task 4: Shared `greetings.ts` (TDD)

**Files:**

- Create: `packages/shared/src/greetings.ts` + `.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/shared/src/greetings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GREETING_TEMPLATES, buildGreeting } from "./greetings";
import { SUPPORTED_LANG_CODES } from "./languages";

describe("GREETING_TEMPLATES", () => {
  it("covers every supported language", () => {
    for (const lang of SUPPORTED_LANG_CODES) {
      expect(GREETING_TEMPLATES[lang]).toBeTruthy();
    }
  });

  it("every template contains the {name} placeholder", () => {
    for (const lang of SUPPORTED_LANG_CODES) {
      expect(GREETING_TEMPLATES[lang]).toContain("{name}");
    }
  });
});

describe("buildGreeting", () => {
  it("interpolates the name", () => {
    expect(buildGreeting("en", "Bruno")).toBe(
      "Hi Bruno! What would you like to talk about today?",
    );
  });

  it("works for every supported language", () => {
    for (const lang of SUPPORTED_LANG_CODES) {
      const result = buildGreeting(lang, "Bruno");
      expect(result).toContain("Bruno");
      expect(result).not.toContain("{name}");
    }
  });
});
```

- [ ] **Step 2: Run tests, confirm failure**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/packages/shared"
pnpm test greetings
```

Expected: `Cannot find module './greetings'`.

- [ ] **Step 3: Implement**

Create `packages/shared/src/greetings.ts`:

```ts
import type { SupportedLang } from "./languages";

export const GREETING_TEMPLATES: Record<SupportedLang, string> = {
  en: "Hi {name}! What would you like to talk about today?",
  fr: "Salut {name} ! De quoi veux-tu parler aujourd'hui ?",
  de: "Hallo {name}! Worüber möchtest du heute sprechen?",
  it: "Ciao {name}! Di cosa vuoi parlare oggi?",
  es: "¡Hola {name}! ¿De qué quieres hablar hoy?",
  pt: "Olá {name}! Sobre o que queres falar hoje?",
  tr: "Merhaba {name}! Bugün ne hakkında konuşmak istersin?",
  sv: "Hej {name}! Vad vill du prata om idag?",
  da: "Hej {name}! Hvad vil du tale om i dag?",
  ru: "Привет, {name}! О чём хочешь поговорить сегодня?",
  ro: "Bună, {name}! Despre ce vrei să vorbim astăzi?",
  hu: "Szia {name}! Miről szeretnél ma beszélni?",
};

export function buildGreeting(lang: SupportedLang, name: string): string {
  return GREETING_TEMPLATES[lang].replace("{name}", name);
}
```

- [ ] **Step 4: Re-export**

Modify `packages/shared/src/index.ts` — append:

```ts
export * from "./greetings";
```

- [ ] **Step 5: Run tests + typecheck**

```bash
pnpm test greetings
cd ../..
pnpm typecheck
```

Expected: 4 tests pass, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/greetings.ts packages/shared/src/greetings.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): coach greeting templates + buildGreeting (Plan 6)"
```

---

### Task 5: Shared `coach-fallbacks.ts` (TDD)

**Files:**

- Create: `packages/shared/src/coach-fallbacks.ts` + `.test.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/shared/src/coach-fallbacks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  COACH_FALLBACKS,
  getCoachFallback,
  type SoftErrorCode,
} from "./coach-fallbacks";
import { SUPPORTED_LANG_CODES } from "./languages";

const ALL_CODES: SoftErrorCode[] = [
  "AUDIO_SILENT",
  "AUDIO_TOO_SHORT",
  "STT_PROVIDER_FAILURE",
  "LLM_PROVIDER_FAILURE",
  "TTS_PROVIDER_FAILURE",
];

describe("COACH_FALLBACKS", () => {
  it("covers every supported language and every soft code", () => {
    for (const lang of SUPPORTED_LANG_CODES) {
      for (const code of ALL_CODES) {
        expect(COACH_FALLBACKS[lang]?.[code]).toBeTruthy();
      }
    }
  });
});

describe("getCoachFallback", () => {
  it("returns the right English string for AUDIO_SILENT", () => {
    expect(getCoachFallback("en", "AUDIO_SILENT")).toBe(
      "Hmm, I didn't catch that — could you try again?",
    );
  });

  it("falls back to English when language is unknown", () => {
    // @ts-expect-error testing unknown lang
    const out = getCoachFallback("xx", "AUDIO_SILENT");
    expect(out).toBe("Hmm, I didn't catch that — could you try again?");
  });
});
```

- [ ] **Step 2: Run tests, confirm failure**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/packages/shared"
pnpm test coach-fallbacks
```

Expected: `Cannot find module './coach-fallbacks'`.

- [ ] **Step 3: Implement**

Create `packages/shared/src/coach-fallbacks.ts`:

```ts
import type { SupportedLang } from "./languages";

export type SoftErrorCode =
  | "AUDIO_SILENT"
  | "AUDIO_TOO_SHORT"
  | "STT_PROVIDER_FAILURE"
  | "LLM_PROVIDER_FAILURE"
  | "TTS_PROVIDER_FAILURE";

type FallbackMap = Record<SoftErrorCode, string>;

export const COACH_FALLBACKS: Record<SupportedLang, FallbackMap> = {
  en: {
    AUDIO_SILENT: "Hmm, I didn't catch that — could you try again?",
    AUDIO_TOO_SHORT: "That was a bit too short — give it another go!",
    STT_PROVIDER_FAILURE: "I'm having trouble hearing — could you repeat?",
    LLM_PROVIDER_FAILURE: "Something on my end glitched — let's keep going.",
    TTS_PROVIDER_FAILURE: "(Audio failed — read my message above.)",
  },
  fr: {
    AUDIO_SILENT: "Hmm, je n'ai pas entendu — tu peux répéter ?",
    AUDIO_TOO_SHORT: "C'était un peu court — essaie encore !",
    STT_PROVIDER_FAILURE: "J'ai du mal à entendre — répète s'il te plaît ?",
    LLM_PROVIDER_FAILURE: "Petit bug de mon côté — on continue.",
    TTS_PROVIDER_FAILURE: "(L'audio a échoué — lis mon message ci-dessus.)",
  },
  de: {
    AUDIO_SILENT: "Hmm, das habe ich nicht gehört — kannst du es wiederholen?",
    AUDIO_TOO_SHORT: "Das war etwas zu kurz — versuch es noch einmal!",
    STT_PROVIDER_FAILURE: "Ich höre dich schlecht — kannst du es wiederholen?",
    LLM_PROVIDER_FAILURE:
      "Bei mir ist etwas schiefgelaufen — machen wir weiter.",
    TTS_PROVIDER_FAILURE: "(Audio fehlgeschlagen — lies meine Nachricht oben.)",
  },
  it: {
    AUDIO_SILENT: "Hmm, non ho sentito — puoi ripetere?",
    AUDIO_TOO_SHORT: "Era un po' troppo breve — riprova!",
    STT_PROVIDER_FAILURE: "Ho difficoltà a sentirti — ripeti per favore?",
    LLM_PROVIDER_FAILURE: "Piccolo problema da parte mia — andiamo avanti.",
    TTS_PROVIDER_FAILURE: "(Audio non riuscito — leggi il messaggio sopra.)",
  },
  es: {
    AUDIO_SILENT: "Hmm, no te escuché — ¿puedes intentarlo de nuevo?",
    AUDIO_TOO_SHORT: "Fue un poco corto — ¡inténtalo otra vez!",
    STT_PROVIDER_FAILURE: "Me cuesta oírte — ¿puedes repetirlo?",
    LLM_PROVIDER_FAILURE: "Algo falló de mi lado — sigamos.",
    TTS_PROVIDER_FAILURE: "(Audio falló — lee mi mensaje arriba.)",
  },
  pt: {
    AUDIO_SILENT: "Hmm, não ouvi — podes tentar de novo?",
    AUDIO_TOO_SHORT: "Foi um bocadinho curto — tenta outra vez!",
    STT_PROVIDER_FAILURE: "Tenho dificuldade em ouvir — podes repetir?",
    LLM_PROVIDER_FAILURE: "Algo correu mal aqui — vamos continuar.",
    TTS_PROVIDER_FAILURE: "(Áudio falhou — lê a minha mensagem acima.)",
  },
  tr: {
    AUDIO_SILENT: "Hmm, duyamadım — tekrar dener misin?",
    AUDIO_TOO_SHORT: "Biraz kısaydı — bir daha dene!",
    STT_PROVIDER_FAILURE: "Seni duymakta zorlanıyorum — tekrar eder misin?",
    LLM_PROVIDER_FAILURE: "Benim tarafımda bir sorun oldu — devam edelim.",
    TTS_PROVIDER_FAILURE: "(Ses başarısız oldu — yukarıdaki mesajımı oku.)",
  },
  sv: {
    AUDIO_SILENT: "Hmm, jag hörde inte — kan du försöka igen?",
    AUDIO_TOO_SHORT: "Det var lite för kort — försök igen!",
    STT_PROVIDER_FAILURE: "Jag har svårt att höra — kan du upprepa?",
    LLM_PROVIDER_FAILURE: "Något strulade hos mig — vi fortsätter.",
    TTS_PROVIDER_FAILURE: "(Ljudet misslyckades — läs mitt meddelande ovan.)",
  },
  da: {
    AUDIO_SILENT: "Hmm, jeg hørte det ikke — kan du prøve igen?",
    AUDIO_TOO_SHORT: "Det var lidt for kort — prøv igen!",
    STT_PROVIDER_FAILURE: "Jeg har svært ved at høre — kan du gentage?",
    LLM_PROVIDER_FAILURE: "Noget gik galt hos mig — vi fortsætter.",
    TTS_PROVIDER_FAILURE: "(Lyden mislykkedes — læs min besked ovenfor.)",
  },
  ru: {
    AUDIO_SILENT: "Хм, я не расслышал — повтори, пожалуйста?",
    AUDIO_TOO_SHORT: "Слишком коротко — попробуй ещё раз!",
    STT_PROVIDER_FAILURE: "Мне трудно расслышать — повтори?",
    LLM_PROVIDER_FAILURE: "У меня небольшой сбой — продолжим.",
    TTS_PROVIDER_FAILURE: "(Аудио не удалось — прочти моё сообщение выше.)",
  },
  ro: {
    AUDIO_SILENT: "Hmm, n-am auzit — poți să încerci din nou?",
    AUDIO_TOO_SHORT: "A fost cam scurt — mai încearcă o dată!",
    STT_PROVIDER_FAILURE: "Am dificultăți să te aud — poți repeta?",
    LLM_PROVIDER_FAILURE: "Ceva s-a stricat de la mine — continuăm.",
    TTS_PROVIDER_FAILURE: "(Audio eșuat — citește mesajul meu de sus.)",
  },
  hu: {
    AUDIO_SILENT: "Hmm, nem hallottam — meg tudnád próbálni újra?",
    AUDIO_TOO_SHORT: "Kicsit rövid volt — próbáld meg újra!",
    STT_PROVIDER_FAILURE: "Nehezen hallak — meg tudnád ismételni?",
    LLM_PROVIDER_FAILURE: "Valami nem stimmelt nálam — folytassuk.",
    TTS_PROVIDER_FAILURE: "(Hang sikertelen — olvasd a fenti üzenetem.)",
  },
};

export function getCoachFallback(
  lang: SupportedLang | string,
  code: SoftErrorCode,
): string {
  const map = COACH_FALLBACKS[lang as SupportedLang] ?? COACH_FALLBACKS.en;
  return map[code];
}
```

- [ ] **Step 4: Re-export**

Modify `packages/shared/src/index.ts` — append:

```ts
export * from "./coach-fallbacks";
```

- [ ] **Step 5: Run tests + typecheck**

```bash
pnpm test coach-fallbacks
cd ../..
pnpm typecheck
```

Expected: 3 tests pass, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/coach-fallbacks.ts packages/shared/src/coach-fallbacks.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): coach fallback messages for soft errors (Plan 6)"
```

---

### Task 6: Mobile `use-session-timer` hook

**Files:**

- Create: `apps/mobile/src/features/practice/use-session-timer.ts`

- [ ] **Step 1: Implement**

```ts
import { useEffect, useRef, useState } from "react";

/**
 * Counts seconds while `active` is true. Pauses when inactive.
 * Pure timer hook — no audio/state-machine awareness.
 */
export function useSessionTimer(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active]);

  function reset() {
    setSeconds(0);
  }

  return { seconds, reset };
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/mobile"
pnpm typecheck
cd ../..
git add apps/mobile/src/features/practice/use-session-timer.ts
git commit -m "feat(mobile): useSessionTimer hook (Plan 6)"
```

---

### Task 7: Mobile `audio-queue` (TDD)

**Files:**

- Create: `apps/mobile/src/features/practice/audio-queue.ts` + `.test.ts`

- [ ] **Step 1: Write failing tests (queue logic only — no audio playback)**

Create `apps/mobile/src/features/practice/audio-queue.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { AudioQueue, type Chunk } from "./audio-queue";

function makeChunk(index: number): Chunk {
  return {
    index,
    text: `text-${index}`,
    audioUrl: `https://example.com/${index}.mp3`,
    durationMs: 100,
  };
}

describe("AudioQueue", () => {
  it("plays chunks in index order even if enqueued out of order", async () => {
    const played: number[] = [];
    const q = new AudioQueue({
      playChunk: async (c) => {
        played.push(c.index);
      },
    });
    q.enqueue(makeChunk(2));
    q.enqueue(makeChunk(0));
    q.enqueue(makeChunk(1));
    await q.waitForDrain();
    expect(played).toEqual([0, 1, 2]);
  });

  it("plays chunks as they arrive in order", async () => {
    const played: number[] = [];
    const q = new AudioQueue({
      playChunk: async (c) => {
        played.push(c.index);
      },
    });
    q.enqueue(makeChunk(0));
    q.enqueue(makeChunk(1));
    await q.waitForDrain();
    expect(played).toEqual([0, 1]);
  });

  it("reset clears state", async () => {
    const playChunk = vi.fn(async () => {});
    const q = new AudioQueue({ playChunk });
    q.enqueue(makeChunk(0));
    q.reset();
    q.enqueue(makeChunk(0));
    await q.waitForDrain();
    expect(playChunk).toHaveBeenCalledTimes(2);
  });

  it("isPlaying reflects activity", async () => {
    let release: () => void = () => {};
    const q = new AudioQueue({
      playChunk: () =>
        new Promise<void>((r) => {
          release = r;
        }),
    });
    q.enqueue(makeChunk(0));
    await new Promise((r) => setTimeout(r, 0));
    expect(q.isPlaying()).toBe(true);
    release();
    await q.waitForDrain();
    expect(q.isPlaying()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, confirm failure**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/mobile"
pnpm test audio-queue
```

Expected: cannot find module.

- [ ] **Step 3: Implement (separate the playback adapter from the queue logic for testability)**

Create `apps/mobile/src/features/practice/audio-queue.ts`:

```ts
export type Chunk = {
  index: number;
  text: string;
  audioUrl: string;
  durationMs: number;
};

export type AudioQueueDeps = {
  /** Plays one chunk to completion. Resolves when audio finishes (or fails silently). */
  playChunk: (chunk: Chunk) => Promise<void>;
};

/**
 * Pure queue logic for ordered chunk playback. No audio API knowledge —
 * the playChunk adapter does the actual playback. Testable in isolation.
 */
export class AudioQueue {
  private chunks = new Map<number, Chunk>();
  private nextToPlay = 0;
  private playing = false;
  private drainResolvers: Array<() => void> = [];

  constructor(private deps: AudioQueueDeps) {}

  enqueue(chunk: Chunk): void {
    this.chunks.set(chunk.index, chunk);
    if (!this.playing) {
      void this.drain();
    }
  }

  isPlaying(): boolean {
    return this.playing;
  }

  reset(): void {
    this.chunks.clear();
    this.nextToPlay = 0;
    this.playing = false;
    // Don't resolve drain promises — they're tied to a different play cycle
    this.drainResolvers = [];
  }

  /** Resolves when the queue has finished playing everything currently enqueued. */
  waitForDrain(): Promise<void> {
    if (!this.playing && !this.chunks.has(this.nextToPlay)) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.drainResolvers.push(resolve);
    });
  }

  private async drain(): Promise<void> {
    this.playing = true;
    while (this.chunks.has(this.nextToPlay)) {
      const chunk = this.chunks.get(this.nextToPlay)!;
      try {
        await this.deps.playChunk(chunk);
      } catch {
        // best-effort: skip the chunk and move on
      }
      this.chunks.delete(this.nextToPlay);
      this.nextToPlay += 1;
    }
    this.playing = false;
    const resolvers = this.drainResolvers.splice(0);
    for (const r of resolvers) r();
  }
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
pnpm test audio-queue
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app"
git add apps/mobile/src/features/practice/audio-queue.ts apps/mobile/src/features/practice/audio-queue.test.ts
git commit -m "feat(mobile): AudioQueue for ordered chunk playback (Plan 6)"
```

---

### Task 8: Mobile `audio-rms` (TDD with file-size fallback)

**Files:**

- Create: `apps/mobile/src/features/practice/audio-rms.ts` + `.test.ts`

We use the **simple fallback** from the spec: small file or short duration = likely silent. Robust enough for v1 without M4A decoding.

- [ ] **Step 1: Write failing tests**

Create `apps/mobile/src/features/practice/audio-rms.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isLikelySilent } from "./audio-rms";

describe("isLikelySilent", () => {
  it("returns true for very short duration (< 500ms)", () => {
    expect(isLikelySilent({ durationMs: 200, fileSizeBytes: 5000 })).toBe(true);
  });

  it("returns true for very small file (< 2KB)", () => {
    expect(isLikelySilent({ durationMs: 1000, fileSizeBytes: 1500 })).toBe(
      true,
    );
  });

  it("returns false for normal audio", () => {
    expect(isLikelySilent({ durationMs: 2000, fileSizeBytes: 20000 })).toBe(
      false,
    );
  });

  it("handles missing duration gracefully (treated as not silent)", () => {
    expect(
      isLikelySilent({ durationMs: undefined, fileSizeBytes: 10000 }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, confirm failure**

```bash
pnpm test audio-rms
```

Expected: cannot find module.

- [ ] **Step 3: Implement**

Create `apps/mobile/src/features/practice/audio-rms.ts`:

```ts
/**
 * Cheap silence heuristic for v1. Avoids decoding the M4A buffer in JS.
 *
 * Two signals:
 *   - duration < 500ms → user tapped+released too fast, likely silent
 *   - file size < 2KB → almost no audio data, likely silent
 *
 * Server-side AUDIO_SILENT detection is the source of truth; this just
 * skips the round-trip when it's obviously empty.
 */
export type SilenceSignals = {
  durationMs: number | undefined;
  fileSizeBytes: number;
};

const MIN_DURATION_MS = 500;
const MIN_FILE_BYTES = 2000;

export function isLikelySilent(signals: SilenceSignals): boolean {
  if (signals.fileSizeBytes < MIN_FILE_BYTES) return true;
  if (
    signals.durationMs !== undefined &&
    signals.durationMs < MIN_DURATION_MS
  ) {
    return true;
  }
  return false;
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
pnpm test audio-rms
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app"
git add apps/mobile/src/features/practice/audio-rms.ts apps/mobile/src/features/practice/audio-rms.test.ts
git commit -m "feat(mobile): isLikelySilent heuristic for client-side silence detection (Plan 6)"
```

---

### Task 9: Mobile API client TurnEvent type updates + helpers

**Files:**

- Modify: `apps/mobile/src/lib/api-client.ts` — replace `reply-text-delta` + `reply-audio` with `reply-chunk` in TurnEvent + EventSource handlers
- Create: `apps/mobile/src/features/practice/api-greeting.ts`
- Create: `apps/mobile/src/features/practice/api-message-audio.ts`

- [ ] **Step 1: Update TurnEvent type in api-client.ts**

Open `apps/mobile/src/lib/api-client.ts`. Find `TurnEvent` and `TurnEventName`. Replace:

```ts
export type TurnEvent =
  | { type: "transcription"; text: string }
  | {
      type: "reply-chunk";
      index: number;
      text: string;
      audioUrl: string;
      durationMs: number;
    }
  | { type: "done"; messageId: string }
  | { type: "error"; code: string; message: string; retryable: boolean };

type TurnEventName = "transcription" | "reply-chunk" | "done";
```

Then in the EventSource setup inside `streamTurn`, replace the `reply-text-delta` and `reply-audio` listeners with one `reply-chunk` listener:

```ts
es.addEventListener("reply-chunk", (e) => {
  if (!e.data) return;
  const data = JSON.parse(e.data) as {
    index: number;
    text: string;
    audioUrl: string;
    durationMs: number;
  };
  push({
    type: "reply-chunk",
    index: data.index,
    text: data.text,
    audioUrl: data.audioUrl,
    durationMs: data.durationMs,
  });
});
```

Remove the existing `reply-text-delta` and `reply-audio` listeners.

- [ ] **Step 2: Create `api-greeting.ts`**

```ts
import { API_BASE_URL, authHeader } from "@/src/lib/api-client";

export async function fetchGreetingAudio(input: {
  lang: string;
  name: string;
}): Promise<{ audioUrl: string }> {
  const res = await fetch(`${API_BASE_URL}/v1/voice/greeting/audio`, {
    method: "POST",
    headers: {
      authorization: await authHeader(),
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`greeting audio ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ audioUrl: string }>;
}
```

- [ ] **Step 3: Create `api-message-audio.ts`**

```ts
import { API_BASE_URL, authHeader } from "@/src/lib/api-client";

export async function fetchMessageAudio(
  messageId: string,
): Promise<{ audioUrl: string }> {
  const res = await fetch(`${API_BASE_URL}/v1/messages/${messageId}/audio`, {
    method: "POST",
    headers: { authorization: await authHeader() },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`message audio ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ audioUrl: string }>;
}
```

- [ ] **Step 4: Typecheck**

Note: the api-client TurnEvent change will break `use-conversation.ts` until Task 18 rewrites it. Acceptable for this batch — typecheck will fail on use-conversation but that's expected and will resolve in Task 18. Verify only the three files we edited typecheck cleanly:

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/mobile"
pnpm typecheck 2>&1 | tail -10
```

Expected: errors only in `use-conversation.ts` referring to `reply-text-delta` / `reply-audio`. The new files + `api-client.ts` should not produce errors.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app"
git add apps/mobile/src/lib/api-client.ts apps/mobile/src/features/practice/api-greeting.ts apps/mobile/src/features/practice/api-message-audio.ts
git commit -m "feat(mobile): TurnEvent reply-chunk type + api-greeting + api-message-audio helpers (Plan 6)"
```

---

## Phase 3 — Backend routes (sequential after Phase 2)

### Task 10: Storage helper extension

**Files:**

- Modify: `apps/api/src/lib/storage.ts`

- [ ] **Step 1: Add helpers**

Open `apps/api/src/lib/storage.ts`. The file already has `uploadCoachAudio`. Add two new exports:

```ts
export async function uploadCoachAudioChunk(
  client: SupabaseStorageClient,
  input: {
    userId: string;
    conversationId: string;
    messageId: string;
    chunkIndex: number;
    audioBuffer: Buffer;
    contentType: string;
  },
): Promise<{ audioUrl: string }> {
  const path = `${input.userId}/${input.conversationId}/${input.messageId}-${input.chunkIndex}.mp3`;
  const { error: uploadErr } = await client
    .from("user-audio")
    .upload(path, input.audioBuffer, {
      contentType: input.contentType,
      upsert: true,
    });
  if (uploadErr) throw new Error(`storage upload failed: ${uploadErr.message}`);

  const { data, error: signErr } = await client
    .from("user-audio")
    .createSignedUrl(path, 60 * 60); // 1 hour
  if (signErr || !data?.signedUrl) {
    throw new Error(`storage sign failed: ${signErr?.message}`);
  }
  return { audioUrl: data.signedUrl };
}

export async function uploadGreetingAudio(
  client: SupabaseStorageClient,
  input: {
    lang: string;
    nameHash: string;
    audioBuffer: Buffer;
    contentType: string;
  },
): Promise<{ audioUrl: string }> {
  const path = `greeting-${input.lang}-${input.nameHash}.mp3`;
  const { error: uploadErr } = await client
    .from("greeting-audio")
    .upload(path, input.audioBuffer, {
      contentType: input.contentType,
      upsert: true,
    });
  if (uploadErr)
    throw new Error(`greeting upload failed: ${uploadErr.message}`);

  const { data, error: signErr } = await client
    .from("greeting-audio")
    .createSignedUrl(path, 60 * 60 * 24 * 7); // 1 week
  if (signErr || !data?.signedUrl) {
    throw new Error(`greeting sign failed: ${signErr?.message}`);
  }
  return { audioUrl: data.signedUrl };
}

export async function getGreetingAudioUrl(
  client: SupabaseStorageClient,
  input: { lang: string; nameHash: string },
): Promise<string | null> {
  const path = `greeting-${input.lang}-${input.nameHash}.mp3`;
  const { data: list, error: listErr } = await client
    .from("greeting-audio")
    .list("", { search: path });
  if (listErr) return null;
  if (!list || list.length === 0 || !list.find((f) => f.name === path)) {
    return null;
  }
  const { data, error: signErr } = await client
    .from("greeting-audio")
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (signErr || !data?.signedUrl) return null;
  return data.signedUrl;
}
```

(`SupabaseStorageClient` type alias is already in this file — match the existing pattern.)

- [ ] **Step 2: Apply the Storage bucket creation SQL** (one-shot, manually via Supabase SQL Editor)

Document this in the commit message. Bruno needs to run in Supabase SQL Editor:

```sql
-- Create greeting-audio bucket as PUBLIC (greetings are not user-private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('greeting-audio', 'greeting-audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated users to read greeting audio (public bucket means signed URLs work)
CREATE POLICY IF NOT EXISTS "greeting_audio_read_authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'greeting-audio');

-- Allow service role to write (server-side only)
CREATE POLICY IF NOT EXISTS "greeting_audio_write_service"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'greeting-audio');

CREATE POLICY IF NOT EXISTS "greeting_audio_update_service"
  ON storage.objects FOR UPDATE
  TO service_role
  WITH CHECK (bucket_id = 'greeting-audio');
```

Run this once and confirm the bucket exists in Supabase dashboard.

- [ ] **Step 3: Typecheck + commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/api"
pnpm typecheck
cd ../..
git add apps/api/src/lib/storage.ts
git commit -m "feat(api): storage helpers for chunked coach audio + greeting audio (Plan 6)

REQUIRES: run SQL in Supabase Editor to create greeting-audio bucket (see plan task 10 step 2)"
```

---

### Task 11: Voice greeting route (TDD)

**Files:**

- Create: `apps/api/src/routes/voice-greeting.ts`
- Create: `apps/api/src/routes/voice-greeting.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { createVoiceGreetingRoutes } from "./voice-greeting";

const userId = "00000000-0000-0000-0000-000000000001";

function appWithRoutes(routes: ReturnType<typeof createVoiceGreetingRoutes>) {
  const app = new Hono<{ Variables: { userId: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", userId);
    await next();
  });
  app.route("/v1/voice/greeting", routes);
  return app;
}

describe("POST /v1/voice/greeting/audio", () => {
  it("returns cached URL when greeting exists in storage", async () => {
    const getCached = vi
      .fn()
      .mockResolvedValue("https://cdn.test/greeting-it-abc.mp3");
    const tts = vi.fn();
    const upload = vi.fn();
    const routes = createVoiceGreetingRoutes({
      getCachedGreetingUrl: getCached,
      synthesizeSpeech: tts,
      uploadGreeting: upload,
    });
    const app = appWithRoutes(routes);
    const res = await app.request("/v1/voice/greeting/audio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang: "it", name: "Bruno" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      audioUrl: "https://cdn.test/greeting-it-abc.mp3",
    });
    expect(tts).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("generates and uploads when not cached", async () => {
    const getCached = vi.fn().mockResolvedValue(null);
    const tts = vi.fn().mockResolvedValue({
      audioBuffer: Buffer.from("fake-audio"),
      contentType: "audio/mpeg",
    });
    const upload = vi
      .fn()
      .mockResolvedValue({ audioUrl: "https://cdn.test/new.mp3" });
    const routes = createVoiceGreetingRoutes({
      getCachedGreetingUrl: getCached,
      synthesizeSpeech: tts,
      uploadGreeting: upload,
    });
    const app = appWithRoutes(routes);
    const res = await app.request("/v1/voice/greeting/audio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang: "it", name: "Bruno" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      audioUrl: "https://cdn.test/new.mp3",
    });
    expect(tts).toHaveBeenCalledOnce();
    expect(upload).toHaveBeenCalledOnce();
  });

  it("returns 400 on missing lang or name", async () => {
    const routes = createVoiceGreetingRoutes({
      getCachedGreetingUrl: vi.fn(),
      synthesizeSpeech: vi.fn(),
      uploadGreeting: vi.fn(),
    });
    const app = appWithRoutes(routes);
    const res = await app.request("/v1/voice/greeting/audio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang: "it" }),
    });
    expect(res.status).toBe(400);
  });

  it("returns 503 when TTS fails", async () => {
    const routes = createVoiceGreetingRoutes({
      getCachedGreetingUrl: vi.fn().mockResolvedValue(null),
      synthesizeSpeech: vi.fn().mockRejectedValue(new Error("openai down")),
      uploadGreeting: vi.fn(),
    });
    const app = appWithRoutes(routes);
    const res = await app.request("/v1/voice/greeting/audio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang: "it", name: "Bruno" }),
    });
    expect(res.status).toBe(503);
  });

  it("uses sha1-truncated nameHash so 'Bruno' and 'bruno' share cache", async () => {
    const getCached = vi.fn().mockResolvedValue(null);
    const tts = vi.fn().mockResolvedValue({
      audioBuffer: Buffer.from("x"),
      contentType: "audio/mpeg",
    });
    const upload = vi.fn().mockResolvedValue({ audioUrl: "https://x" });
    const routes = createVoiceGreetingRoutes({
      getCachedGreetingUrl: getCached,
      synthesizeSpeech: tts,
      uploadGreeting: upload,
    });
    const app = appWithRoutes(routes);

    await app.request("/v1/voice/greeting/audio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang: "it", name: "Bruno" }),
    });
    await app.request("/v1/voice/greeting/audio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang: "it", name: "bruno" }),
    });

    // Both calls should target the same cache key
    const calls = upload.mock.calls.map((c) => c[0].nameHash);
    expect(calls[0]).toBe(calls[1]);
  });
});
```

- [ ] **Step 2: Run tests, confirm failure**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/api"
pnpm test voice-greeting
```

Expected: cannot find module.

- [ ] **Step 3: Implement**

Create `apps/api/src/routes/voice-greeting.ts`:

```ts
import { createHash } from "node:crypto";
import { Hono } from "hono";
import { z } from "zod";
import { buildGreeting, type SupportedLang } from "@language-coach/shared";

export type SynthesizeGreetingFn = (input: {
  text: string;
  voiceId: string;
}) => Promise<{ audioBuffer: Buffer; contentType: string }>;

export type UploadGreetingFn = (input: {
  lang: string;
  nameHash: string;
  audioBuffer: Buffer;
  contentType: string;
}) => Promise<{ audioUrl: string }>;

export type GetCachedGreetingUrlFn = (input: {
  lang: string;
  nameHash: string;
}) => Promise<string | null>;

export type VoiceGreetingDeps = {
  synthesizeSpeech: SynthesizeGreetingFn;
  uploadGreeting: UploadGreetingFn;
  getCachedGreetingUrl: GetCachedGreetingUrlFn;
};

const BodySchema = z.object({
  lang: z.string().min(2),
  name: z.string().min(1),
});

function nameHashOf(name: string): string {
  return createHash("sha1")
    .update(name.toLowerCase().trim(), "utf8")
    .digest("hex")
    .slice(0, 12);
}

export function createVoiceGreetingRoutes(deps: VoiceGreetingDeps) {
  const app = new Hono<{ Variables: { userId: string } }>();

  app.post("/audio", async (c) => {
    const parsed = BodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return c.json({ error: { code: "BAD_REQUEST" } }, 400);
    }
    const { lang, name } = parsed.data;
    const nameHash = nameHashOf(name);

    const cached = await deps.getCachedGreetingUrl({ lang, nameHash });
    if (cached) {
      return c.json({ audioUrl: cached });
    }

    const text = buildGreeting(lang as SupportedLang, name);

    let audio: { audioBuffer: Buffer; contentType: string };
    try {
      audio = await deps.synthesizeSpeech({ text, voiceId: "nova" });
    } catch {
      return c.json({ error: { code: "TTS_PROVIDER_FAILURE" } }, 503);
    }

    const { audioUrl } = await deps.uploadGreeting({
      lang,
      nameHash,
      audioBuffer: audio.audioBuffer,
      contentType: audio.contentType,
    });

    return c.json({ audioUrl });
  });

  return app;
}
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
pnpm test voice-greeting
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app"
git add apps/api/src/routes/voice-greeting.ts apps/api/src/routes/voice-greeting.test.ts
git commit -m "feat(api): POST /v1/voice/greeting/audio (Plan 6)"
```

---

### Task 12: Message audio route (extend existing messages.ts)

**Files:**

- Modify: `apps/api/src/routes/messages.ts`
- Modify: `apps/api/src/routes/messages.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `apps/api/src/routes/messages.test.ts` (inside the existing `describe("POST /v1/messages/:id/translate", ...)` block — keep it as a sibling):

```ts
describe("POST /v1/messages/:id/audio", () => {
  it("returns cached audio URL when message has audioStoragePath", async () => {
    const db = makeFakeDb({
      message: {
        id: messageId,
        role: "coach",
        text: "Buongiorno",
        translation: null,
        conversationId,
        conversationUserId: userId,
      },
      profile: { nativeLang: "fr" },
    });
    // augment fake db to return the message with audioStoragePath
    db.query.messages.findFirst = vi.fn().mockResolvedValue({
      id: messageId,
      role: "coach",
      text: "Buongiorno",
      audioStoragePath: "user/conv/msg.mp3",
      conversation: { id: conversationId, userId },
    });
    const synthesize = vi.fn();
    const getCachedAudioUrl = vi.fn().mockResolvedValue("https://cdn/msg.mp3");
    const uploadChunk = vi.fn();

    const routes = createMessagesRoutes({
      db: db as never,
      translate: vi.fn(),
      synthesizeSpeech: synthesize,
      uploadCoachAudioChunk: uploadChunk,
      getCachedAudioUrl,
    });
    const app = appWithMessages(routes);

    const res = await app.request(`/v1/messages/${messageId}/audio`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ audioUrl: "https://cdn/msg.mp3" });
    expect(synthesize).not.toHaveBeenCalled();
  });

  it("regenerates + uploads when no cached audio", async () => {
    const db = makeFakeDb({
      message: {
        id: messageId,
        role: "coach",
        text: "Buongiorno",
        translation: null,
        conversationId,
        conversationUserId: userId,
      },
      profile: { nativeLang: "fr" },
    });
    db.query.messages.findFirst = vi.fn().mockResolvedValue({
      id: messageId,
      role: "coach",
      text: "Buongiorno",
      audioStoragePath: null,
      conversation: {
        id: conversationId,
        userId,
        language: "it",
      },
    });
    const synthesize = vi.fn().mockResolvedValue({
      audioBuffer: Buffer.from("audio"),
      contentType: "audio/mpeg",
    });
    const uploadChunk = vi
      .fn()
      .mockResolvedValue({ audioUrl: "https://cdn/new.mp3" });

    const routes = createMessagesRoutes({
      db: db as never,
      translate: vi.fn(),
      synthesizeSpeech: synthesize,
      uploadCoachAudioChunk: uploadChunk,
      getCachedAudioUrl: vi.fn().mockResolvedValue(null),
    });
    const app = appWithMessages(routes);

    const res = await app.request(`/v1/messages/${messageId}/audio`, {
      method: "POST",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ audioUrl: "https://cdn/new.mp3" });
    expect(synthesize).toHaveBeenCalledOnce();
    expect(uploadChunk).toHaveBeenCalledOnce();
  });

  it("returns 404 when message belongs to another user", async () => {
    const db = makeFakeDb({
      message: {
        id: messageId,
        role: "coach",
        text: "x",
        translation: null,
        conversationId,
        conversationUserId: "99999999-9999-9999-9999-999999999999",
      },
      profile: { nativeLang: "fr" },
    });
    db.query.messages.findFirst = vi.fn().mockResolvedValue({
      id: messageId,
      role: "coach",
      text: "x",
      audioStoragePath: null,
      conversation: {
        id: conversationId,
        userId: "99999999-9999-9999-9999-999999999999",
        language: "it",
      },
    });
    const routes = createMessagesRoutes({
      db: db as never,
      translate: vi.fn(),
      synthesizeSpeech: vi.fn(),
      uploadCoachAudioChunk: vi.fn(),
      getCachedAudioUrl: vi.fn(),
    });
    const app = appWithMessages(routes);
    const res = await app.request(`/v1/messages/${messageId}/audio`, {
      method: "POST",
    });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Extend `MessagesDeps` + add the route**

Modify `apps/api/src/routes/messages.ts`. Update the `MessagesDeps` type:

```ts
export type SynthesizeSpeechFn = (input: {
  text: string;
  voiceId: string;
}) => Promise<{ audioBuffer: Buffer; contentType: string }>;

export type UploadCoachAudioChunkFn = (input: {
  userId: string;
  conversationId: string;
  messageId: string;
  chunkIndex: number;
  audioBuffer: Buffer;
  contentType: string;
}) => Promise<{ audioUrl: string }>;

export type GetCachedAudioUrlFn = (input: {
  userId: string;
  conversationId: string;
  messageId: string;
  chunkIndex: number;
}) => Promise<string | null>;

export type MessagesDeps = {
  db: Database;
  translate: TranslateFn;
  synthesizeSpeech: SynthesizeSpeechFn;
  uploadCoachAudioChunk: UploadCoachAudioChunkFn;
  getCachedAudioUrl: GetCachedAudioUrlFn;
};
```

Add the new route handler after the existing translate route:

```ts
app.post("/:id/audio", async (c) => {
  const messageId = c.req.param("id");
  const userId = c.get("userId");

  const message = await deps.db.query.messages.findFirst({
    where: (m, { eq: e }) => e(m.id, messageId),
    with: { conversation: true },
  });

  if (!message || message.conversation.userId !== userId) {
    return c.json({ error: { code: "NOT_FOUND" } }, 404);
  }

  // Try cache (chunkIndex 0 for full-message audio)
  const cached = await deps.getCachedAudioUrl({
    userId,
    conversationId: message.conversation.id,
    messageId,
    chunkIndex: 0,
  });
  if (cached) {
    return c.json({ audioUrl: cached });
  }

  let audio: { audioBuffer: Buffer; contentType: string };
  try {
    audio = await deps.synthesizeSpeech({
      text: message.text,
      voiceId: "nova",
    });
  } catch {
    return c.json({ error: { code: "TTS_PROVIDER_FAILURE" } }, 503);
  }

  const { audioUrl } = await deps.uploadCoachAudioChunk({
    userId,
    conversationId: message.conversation.id,
    messageId,
    chunkIndex: 0,
    audioBuffer: audio.audioBuffer,
    contentType: audio.contentType,
  });

  return c.json({ audioUrl });
});
```

- [ ] **Step 3: Update existing translate test fakeDb to include the new deps**

Look for the `createMessagesRoutes({ db, translate })` calls in the existing translate tests and extend them to include placeholder no-op fakes for the new deps:

```ts
synthesizeSpeech: vi.fn(),
uploadCoachAudioChunk: vi.fn(),
getCachedAudioUrl: vi.fn(),
```

- [ ] **Step 4: Run tests, confirm pass**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/api"
pnpm test messages
```

Expected: original 6 + new 3 = 9 tests pass.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app"
git add apps/api/src/routes/messages.ts apps/api/src/routes/messages.test.ts
git commit -m "feat(api): POST /v1/messages/:id/audio for per-message replay (Plan 6)"
```

---

### Task 13: Voice route refactor for per-sentence streaming

**Files:**

- Modify: `apps/api/src/routes/voice.ts` (the turn route handler)
- Modify: `apps/api/src/routes/voice-turn.test.ts` (update event assertions)

This is the largest single backend task. Goal: replace the existing flow that emits `reply-text-delta` then `reply-audio` with one that emits `reply-chunk` events as TTS resolves per sentence.

- [ ] **Step 1: Read the current voice.ts to understand the existing handler**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app"
cat apps/api/src/routes/voice.ts
```

Identify the `POST /sessions/:id/turns` handler and the SSE event emission.

- [ ] **Step 2: Refactor the handler**

Inside the existing turn handler, after STT completes and the user message is inserted, replace the existing GPT-stream → emit-deltas → final-TTS → emit-reply-audio sequence with this:

```ts
import { SentenceBuffer } from "../lib/sentence-buffer";

// ... after STT + user message insert + GPT stream opened:

const sentenceBuf = new SentenceBuffer();
let chunkIndex = 0;
const ttsPromises: Promise<void>[] = [];
let fullCoachText = "";

async function emitChunk(text: string, idx: number): Promise<void> {
  let audio;
  try {
    audio = await deps.synthesizeSpeech({ text, voiceId: "nova" });
  } catch {
    sseEmit("error", {
      code: "TTS_PROVIDER_FAILURE",
      message: "TTS failed",
      retryable: true,
    });
    return;
  }
  // Use a temp messageId placeholder — server message id is assigned at the end.
  // For the chunk URL, use convId + a deterministic chunk path.
  const { audioUrl } = await deps.uploadCoachAudioChunk({
    userId,
    conversationId,
    messageId: `pending-${conversationId}-${turnSeq}`,
    chunkIndex: idx,
    audioBuffer: audio.audioBuffer,
    contentType: audio.contentType,
  });
  // Approximate duration: backend doesn't have it without decoding; pass 0
  // and let mobile compute on play (or leave as 0 — listening-mode shows duration
  // from playback runtime).
  sseEmit("reply-chunk", {
    index: idx,
    text,
    audioUrl,
    durationMs: 0,
  });
}

for await (const delta of streamChatCompletion(openai, { messages: history })) {
  fullCoachText += delta;
  const sentences = sentenceBuf.push(delta);
  for (const s of sentences) {
    const idx = chunkIndex++;
    ttsPromises.push(emitChunk(s, idx));
  }
}

// Flush any remaining buffer as the final chunk
const tail = sentenceBuf.flush();
if (tail) {
  const idx = chunkIndex++;
  ttsPromises.push(emitChunk(tail, idx));
}

await Promise.all(ttsPromises);

// Insert the full coach message (one row, full text)
const [coachRow] = await db
  .insert(messages)
  .values({
    conversationId,
    role: "coach",
    text: fullCoachText,
    audioStoragePath: null, // chunks are at <userId>/<convId>/pending-<convId>-<turnSeq>-<idx>.mp3
  })
  .returning();

sseEmit("done", { messageId: coachRow.id });
```

Drop the existing `reply-text-delta` and `reply-audio` emit calls. Keep `transcription` and `error`.

`turnSeq` is a per-turn counter — keep it simple by using `Date.now()` or a route-local incrementing counter. The pending-prefix means chunks have unique paths per turn even before the message id is known.

**Note on the placeholder messageId:** in v1 we accept that chunk URLs reference a `pending-*` path that's not the final message id. The repeat-message endpoint (Task 12) regenerates from text rather than fetching the chunks, so this isn't a real problem. If chunked-replay-from-storage becomes important later, we can rename the chunks after the message insert.

- [ ] **Step 3: Update VoiceDeps and createVoiceRoutes signature**

Add `uploadCoachAudioChunk` to VoiceDeps if not present:

```ts
uploadCoachAudioChunk: UploadCoachAudioChunkFn,
```

Remove `uploadCoachAudio` (the single-shot version) — or keep both during the transition. Cleanest: remove and update wiring in app.ts (Task 14).

- [ ] **Step 4: Update voice-turn.test.ts**

Replace assertions on `reply-text-delta` + `reply-audio` events with assertions on `reply-chunk` events. Specifically:

For a happy-path test:

- Mock `streamChatCompletion` to yield sentences like: `["Hello", " world.", " How are you?"]`
- Mock `synthesizeSpeech` to return a fake buffer
- Mock `uploadCoachAudioChunk` to return a fake URL per chunk
- Assert the SSE response contains TWO `reply-chunk` events with `index: 0` and `index: 1`
- Assert their `text` fields are `"Hello world."` and `"How are you?"` (sentence-split)
- Assert one `done` event at the end

If existing tests have many small cases, focus on:

1. Single-sentence response → 1 chunk
2. Multi-sentence response → multiple chunks in order
3. TTS failure for one sentence → error event emitted but other chunks still flow
4. STT/AUDIO_SILENT etc. unchanged

Update fakes accordingly. Skip exhaustive rewrite — focus on chunked path coverage.

- [ ] **Step 5: Run tests, confirm pass**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/api"
pnpm test voice
```

Expected: voice-turn tests pass with new chunk-based assertions.

- [ ] **Step 6: Commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app"
git add apps/api/src/routes/voice.ts apps/api/src/routes/voice-turn.test.ts
git commit -m "feat(api): per-sentence streaming TTS with reply-chunk events (Plan 6)"
```

---

### Task 14: Wire new routes + push to deploy

**Files:**

- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Update app.ts wiring**

Open `apps/api/src/app.ts`. Add imports:

```ts
import { createVoiceGreetingRoutes } from "./routes/voice-greeting";
import {
  createStorageClient,
  uploadCoachAudio,
  uploadCoachAudioChunk,
  uploadGreetingAudio,
  getGreetingAudioUrl,
} from "./lib/storage";
import { synthesizeSpeechOpenAI, translateMessage } from "./providers/openai";
```

Inside `createApp`, after `const storage = createStorageClient(env);` add the new routes:

```ts
app.route(
  "/v1/voice/greeting",
  createVoiceGreetingRoutes({
    synthesizeSpeech: (input) => synthesizeSpeechOpenAI(openai, input),
    uploadGreeting: (input) => uploadGreetingAudio(storage, input),
    getCachedGreetingUrl: (input) => getGreetingAudioUrl(storage, input),
  }),
);
```

Update the existing `createMessagesRoutes` wiring to include the new deps:

```ts
app.route(
  "/v1/messages",
  createMessagesRoutes({
    db,
    translate: (input) => translateMessage(openai, input),
    synthesizeSpeech: (input) => synthesizeSpeechOpenAI(openai, input),
    uploadCoachAudioChunk: (input) => uploadCoachAudioChunk(storage, input),
    getCachedAudioUrl: async () => null, // TODO: implement Storage list-by-prefix; for v1 always regenerate
  }),
);
```

Update the existing `createVoiceRoutes` wiring to use `uploadCoachAudioChunk` instead of `uploadCoachAudio` (or keep both if VoiceDeps still has both — match the type changes from Task 13):

```ts
app.route(
  "/v1/voice",
  createVoiceRoutes({
    db,
    transcribeAudio: (input) => transcribeAudio(deepgram, input),
    streamChatCompletion: (input) => streamChatCompletion(openai, input),
    synthesizeSpeech: (input) => synthesizeSpeechOpenAI(openai, input),
    uploadCoachAudioChunk: (input) => uploadCoachAudioChunk(storage, input),
  }),
);
```

- [ ] **Step 2: Typecheck**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/api"
pnpm typecheck
```

Expected: clean.

- [ ] **Step 3: Run all api tests**

```bash
pnpm test
```

Expected: all pass (~50 tests now: 39 + 5 greeting + 3 messages-audio + sentence-buffer + chunk tests).

- [ ] **Step 4: Commit + push**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app"
git add apps/api/src/app.ts
git commit -m "feat(api): wire voice-greeting + chunked audio routes (Plan 6)"
git push
```

CI + Deploy will run. Don't wait — proceed to mobile work.

---

## Phase 4 — Mobile UI components (parallel after Phase 3)

### Task 15: `TopStatusBar.tsx`

**Files:**

- Create: `apps/mobile/src/features/practice/top-status-bar.tsx`

- [ ] **Step 1: Implement**

```tsx
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ShareButton } from "./share-button";
import type { TranscriptMessage } from "./build-transcript";

type Props = {
  // Timer + progress
  todaySeconds: number;
  goalMinutes: number;
  // Streak
  streakDays: number;
  // Listening mode
  listeningMode: boolean;
  onToggleListening: () => void;
  // Share
  shareLanguageCode: string;
  shareStartedAt: Date;
  shareDurationMinutes: number;
  shareMessages: TranscriptMessage[];
  // Exit
  onExit: () => void;
};

export function TopStatusBar(props: Props) {
  const todayMin = Math.floor(props.todaySeconds / 60);
  const goalSec = props.goalMinutes * 60;
  const goalHit = props.todaySeconds >= goalSec && goalSec > 0;

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <Text style={[styles.timer, goalHit && styles.timerGoalHit]}>
          {goalHit
            ? `🎯 ${todayMin} min`
            : `⏱ ${todayMin}/${props.goalMinutes} min`}
        </Text>
        {props.streakDays > 0 ? (
          <Text style={styles.streak}>🔥 {props.streakDays}</Text>
        ) : null}
        <Pressable
          onPress={props.onToggleListening}
          hitSlop={10}
          style={styles.toggle}
        >
          <Text style={styles.toggleIcon}>
            {props.listeningMode ? "🎧" : "👁"}
          </Text>
        </Pressable>
      </View>
      <View style={styles.right}>
        <ShareButton
          languageCode={props.shareLanguageCode}
          startedAt={props.shareStartedAt}
          durationMinutes={props.shareDurationMinutes}
          messages={props.shareMessages}
        />
        <Pressable onPress={props.onExit} style={styles.exitButton}>
          <Text style={styles.exitText}>End</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 56,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
    backgroundColor: "#ffffff",
  },
  left: { flexDirection: "row", alignItems: "center", gap: 12 },
  right: { flexDirection: "row", alignItems: "center", gap: 4 },
  timer: { fontSize: 13, color: "#374151", fontWeight: "600" },
  timerGoalHit: { color: "#059669" },
  streak: { fontSize: 13, color: "#374151" },
  toggle: { padding: 4 },
  toggleIcon: { fontSize: 16 },
  exitButton: { paddingHorizontal: 12, paddingVertical: 6 },
  exitText: { color: "#2563eb", fontWeight: "600" },
});
```

- [ ] **Step 2: Typecheck + commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/mobile"
pnpm typecheck 2>&1 | tail -5
cd ../..
git add apps/mobile/src/features/practice/top-status-bar.tsx
git commit -m "feat(mobile): TopStatusBar with timer + streak + listening toggle (Plan 6)"
```

(Typecheck may still show errors in use-conversation.ts from Task 9 — ignore until Task 18.)

---

### Task 16: `GoalReward.tsx` + `use-goal-reward.ts`

**Files:**

- Create: `apps/mobile/src/features/practice/goal-reward.tsx`
- Create: `apps/mobile/src/features/practice/use-goal-reward.ts`

- [ ] **Step 1: Implement the GoalReward component**

```tsx
import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";

const VICTORY_SOUND = require("@/assets/sounds/victory.mp3");

type Props = {
  visible: boolean;
  streakDays: number;
  onHidden: () => void;
};

export function GoalReward({ visible, streakDays, onHidden }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const playerRef = useRef<AudioPlayer | null>(null);

  useEffect(() => {
    if (!visible) return;

    // Play victory sound
    try {
      const player = createAudioPlayer(VICTORY_SOUND);
      playerRef.current = player;
      player.play();
    } catch {
      // best-effort
    }

    // Slide-in toast
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.delay(2500),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHidden();
      playerRef.current?.remove();
      playerRef.current = null;
    });

    return () => {
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, [visible, opacity, onHidden]);

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <ConfettiCannon count={100} origin={{ x: 180, y: 0 }} autoStart fadeOut />
      <Animated.View style={[styles.toast, { opacity }]}>
        <Text style={styles.toastText}>
          🎉 Goal hit! {streakDays} day{streakDays === 1 ? "" : "s"} in a row 🔥
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: "none",
    zIndex: 999,
  },
  toast: {
    position: "absolute",
    top: 80,
    left: 16,
    right: 16,
    backgroundColor: "#10b981",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toastText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
```

- [ ] **Step 2: Implement the use-goal-reward hook**

```ts
import { useEffect, useRef, useState } from "react";

type UseGoalRewardInput = {
  /** Total seconds spoken today INCLUDING the in-flight session. */
  todaySeconds: number;
  /** Goal in seconds. */
  goalSeconds: number;
  /** Whether the backend already marked today's goal as reached on a previous session. */
  alreadyReachedToday: boolean;
};

/**
 * Detects the moment todaySeconds first crosses goalSeconds in this session,
 * subject to alreadyReachedToday guard. Fires `triggered` exactly once.
 */
export function useGoalReward(input: UseGoalRewardInput) {
  const [triggered, setTriggered] = useState(false);
  const firedRef = useRef(false);
  const prevSecondsRef = useRef(input.todaySeconds);

  useEffect(() => {
    if (firedRef.current) return;
    if (input.alreadyReachedToday) return;
    if (input.goalSeconds <= 0) return;

    const prev = prevSecondsRef.current;
    const now = input.todaySeconds;
    if (prev < input.goalSeconds && now >= input.goalSeconds) {
      firedRef.current = true;
      setTriggered(true);
    }
    prevSecondsRef.current = now;
  }, [input.todaySeconds, input.goalSeconds, input.alreadyReachedToday]);

  function dismiss() {
    setTriggered(false);
  }

  return { triggered, dismiss };
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/mobile"
pnpm typecheck 2>&1 | tail -5
cd ../..
git add apps/mobile/src/features/practice/goal-reward.tsx apps/mobile/src/features/practice/use-goal-reward.ts
git commit -m "feat(mobile): GoalReward (confetti+sound+toast) + useGoalReward hook (Plan 6)"
```

---

### Task 17: `MessageBubble.tsx` listening view + repeat icon

**Files:**

- Modify: `apps/mobile/src/features/practice/MessageBubble.tsx`
- Modify: `apps/mobile/src/features/practice/types.ts`

- [ ] **Step 1: Update ChatMessage type**

Modify `apps/mobile/src/features/practice/types.ts`. Find the `ChatMessage` type and add fields:

```ts
export type ChatMessage = {
  id: string;
  role: "user" | "coach";
  text: string;
  audioUrl?: string;
  audioDurationMs?: number;
  isGreeting?: boolean;
  // (existing fields stay)
};
```

(Adapt to the actual existing shape — the diff should be additive.)

- [ ] **Step 2: Rewrite MessageBubble**

Replace the existing `MessageBubble.tsx` body with the listening-aware version:

```tsx
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { createAudioPlayer } from "expo-audio";
import type { ChatMessage } from "./types";
import { useTranslateMessage } from "./use-translate-message";
import { fetchMessageAudio } from "./api-message-audio";

type Props = {
  message: ChatMessage;
  listeningMode: boolean;
  revealed: boolean;
  onReveal: (id: string) => void;
};

function formatDuration(ms?: number): string {
  if (!ms || ms < 0) return "0:00";
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function MessageBubble({
  message,
  listeningMode,
  revealed,
  onReveal,
}: Props) {
  const isUser = message.role === "user";
  const [translation, setTranslation] = useState<string | null>(null);
  const [showingTranslation, setShowingTranslation] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const translate = useTranslateMessage();

  const showsAsListening = listeningMode && !revealed;

  async function playAudio() {
    setPlayingAudio(true);
    try {
      let url = message.audioUrl;
      if (!url && !isUser) {
        const res = await fetchMessageAudio(message.id);
        url = res.audioUrl;
      }
      if (!url) {
        // user message with no in-memory URI — can't replay v1
        return;
      }
      const player = createAudioPlayer({ uri: url });
      player.play();
      // Fire-and-forget; player auto-cleans on natural end.
    } catch {
      // best-effort
    } finally {
      setPlayingAudio(false);
    }
  }

  async function handleBubblePress() {
    if (showsAsListening) {
      onReveal(message.id);
      void playAudio();
      return;
    }
    if (isUser) return; // user bubbles aren't translatable
    if (translation) {
      setShowingTranslation((s) => !s);
      return;
    }
    try {
      const res = await translate.mutateAsync(message.id);
      setTranslation(res.translation);
      setShowingTranslation(true);
    } catch {
      // best-effort
    }
  }

  function handleRepeatPress() {
    void playAudio();
  }

  const Inner = (
    <View
      style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleCoach]}
    >
      {showsAsListening ? (
        <View style={styles.listeningRow}>
          <Text style={styles.listeningIcon}>🎧</Text>
          <Text style={isUser ? styles.bubbleUserText : styles.bubbleCoachText}>
            {formatDuration(message.audioDurationMs)}
          </Text>
        </View>
      ) : (
        <>
          <Text style={isUser ? styles.bubbleUserText : styles.bubbleCoachText}>
            {message.text}
          </Text>
          {!isUser && showingTranslation && translation ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.translation}>{translation}</Text>
            </>
          ) : null}
          <View style={styles.actionRow}>
            <Pressable onPress={handleRepeatPress} hitSlop={8}>
              <Text style={styles.actionIcon}>{playingAudio ? "▶" : "🔁"}</Text>
            </Pressable>
            {!isUser && !listeningMode ? (
              <Text style={styles.actionIcon}>
                {translate.isPending ? (
                  <ActivityIndicator size="small" color="#6b7280" />
                ) : (
                  "🌐"
                )}
              </Text>
            ) : null}
          </View>
        </>
      )}
    </View>
  );

  return <Pressable onPress={handleBubblePress}>{Inner}</Pressable>;
}

const styles = StyleSheet.create({
  bubble: {
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
    maxWidth: "85%",
  },
  bubbleUser: {
    backgroundColor: "#dbeafe",
    alignSelf: "flex-end",
    borderTopRightRadius: 4,
  },
  bubbleCoach: {
    backgroundColor: "#f3f4f6",
    alignSelf: "flex-start",
    borderTopLeftRadius: 4,
  },
  bubbleUserText: { color: "#111827", fontSize: 16 },
  bubbleCoachText: { color: "#111827", fontSize: 16 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#9ca3af",
    marginVertical: 8,
  },
  translation: { fontSize: 14, color: "#4b5563", fontStyle: "italic" },
  listeningRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  listeningIcon: { fontSize: 18 },
  actionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 6,
  },
  actionIcon: { fontSize: 14, color: "#9ca3af" },
});
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/mobile"
pnpm typecheck 2>&1 | tail -5
cd ../..
git add apps/mobile/src/features/practice/MessageBubble.tsx apps/mobile/src/features/practice/types.ts
git commit -m "feat(mobile): MessageBubble listening view + repeat icon (Plan 6)"
```

(Typecheck may still flag use-conversation.ts — fixed in Task 18.)

---

## Phase 5 — Mobile keystone

### Task 18: `useConversation` rewrite

**Files:**

- Modify: `apps/mobile/src/features/practice/use-conversation.ts`

This is the keystone task. Rewrite to integrate: greeting flow, chunked TTS handling, listening mode, error mapping, RMS check, audio durations.

- [ ] **Step 1: Replace contents of use-conversation.ts**

```ts
import { useEffect, useRef, useState } from "react";
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  getRecordingPermissionsAsync,
  createAudioPlayer,
} from "expo-audio";
import * as FileSystem from "expo-file-system";
import {
  buildGreeting,
  getCoachFallback,
  type SoftErrorCode,
  type SupportedLang,
} from "@language-coach/shared";
import {
  configureForPlayback,
  configureForRecording,
} from "@/src/lib/audio-session";
import { startSession, streamTurn, endSession } from "@/src/lib/api-client";
import type { ChatMessage, ConversationState } from "./types";
import { fetchGreetingAudio } from "./api-greeting";
import { AudioQueue, type Chunk } from "./audio-queue";
import { isLikelySilent } from "./audio-rms";

export type { ChatMessage, ConversationState } from "./types";

const SOFT_ERROR_CODES: ReadonlySet<SoftErrorCode> = new Set([
  "AUDIO_SILENT",
  "AUDIO_TOO_SHORT",
  "STT_PROVIDER_FAILURE",
  "LLM_PROVIDER_FAILURE",
  "TTS_PROVIDER_FAILURE",
]);

export function useConversation(targetLang: string, displayName: string) {
  const [state, setState] = useState<ConversationState>({
    phase: "loading-session",
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [listeningMode, setListeningMode] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const conversationIdRef = useRef<string | null>(null);
  const audioQueueRef = useRef<AudioQueue | null>(null);

  // Reset reveals when listening mode toggles
  useEffect(() => {
    setRevealedIds(new Set());
  }, [listeningMode]);

  // Session start: create conv + insert greeting + fetch + play greeting audio
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { conversation_id } = await startSession(targetLang);
        if (cancelled) return;
        conversationIdRef.current = conversation_id;

        const greetingText = buildGreeting(
          targetLang as SupportedLang,
          displayName,
        );
        const greetingMsg: ChatMessage = {
          id: `greeting-${Date.now()}`,
          role: "coach",
          text: greetingText,
          isGreeting: true,
        };
        setMessages([greetingMsg]);
        setState({ phase: "idle", conversationId: conversation_id });

        // Fetch greeting audio in parallel; failure is non-fatal
        try {
          const { audioUrl } = await fetchGreetingAudio({
            lang: targetLang,
            name: displayName,
          });
          if (cancelled) return;
          setMessages((prev) =>
            prev.map((m) => (m.id === greetingMsg.id ? { ...m, audioUrl } : m)),
          );
          await configureForPlayback();
          const player = createAudioPlayer({ uri: audioUrl });
          player.play();
        } catch {
          // best-effort
        }
      } catch (err) {
        if (cancelled) return;
        setState({ phase: "error", message: (err as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetLang, displayName]);

  async function start() {
    if (state.phase !== "idle") return;
    const conversationId = state.conversationId;
    try {
      let perm = await getRecordingPermissionsAsync();
      if (!perm.granted) perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        throw new Error(
          "Microphone permission denied. Enable it in Settings → Apps → My Language Coach → Permissions.",
        );
      }
      await configureForRecording();
      await recorder.prepareToRecordAsync();
      recorder.record();
      setState({ phase: "recording", conversationId });
    } catch (err) {
      setState({ phase: "error", message: (err as Error).message });
    }
  }

  function pushSoftErrorAsCoachMessage(code: SoftErrorCode) {
    const text = getCoachFallback(targetLang, code);
    setMessages((prev) => [
      ...prev,
      {
        id: `soft-${code}-${Date.now()}`,
        role: "coach",
        text,
      },
    ]);
  }

  async function stop() {
    if (state.phase !== "recording") return;
    const conversationId = state.conversationId;
    setState({ phase: "processing", conversationId });

    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) throw new Error("Recorder produced no audio file");

      // Client-side silence detection (heuristic on file size + duration)
      const status = await recorder.getStatus();
      const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
      const durationMs =
        (status as { durationMillis?: number }).durationMillis ?? undefined;
      const fileSizeBytes = ("size" in fileInfo ? fileInfo.size : 0) ?? 0;
      if (isLikelySilent({ durationMs, fileSizeBytes })) {
        pushSoftErrorAsCoachMessage("AUDIO_SILENT");
        setState({ phase: "idle", conversationId });
        return;
      }

      // Stream turn — handle the new chunk-based protocol
      const { events } = streamTurn(conversationId, uri);
      const audioQueue = new AudioQueue({
        playChunk: async (chunk) => {
          await configureForPlayback();
          const player = createAudioPlayer({ uri: chunk.audioUrl });
          await new Promise<void>((resolve) => {
            const sub = player.addListener("playbackStatusUpdate", (s) => {
              if (s.didJustFinish) {
                sub.remove();
                player.remove();
                resolve();
              }
            });
            player.play();
          });
        },
      });
      audioQueueRef.current = audioQueue;

      let coachMessageId: string | null = null;
      let coachAccumText = "";
      const chunkTexts: string[] = [];

      for await (const event of events) {
        if (event.type === "transcription") {
          // User audio duration for listening mode
          setMessages((prev) => [
            ...prev,
            {
              id: `u-${Date.now()}`,
              role: "user",
              text: event.text,
              audioUrl: uri,
              audioDurationMs: durationMs,
            },
          ]);
        } else if (event.type === "reply-chunk") {
          chunkTexts[event.index] = event.text;
          coachAccumText = chunkTexts.filter(Boolean).join(" ");

          setMessages((prev) => {
            // Either update the in-flight coach message or create it
            const last = prev[prev.length - 1];
            if (
              last &&
              last.role === "coach" &&
              coachMessageId !== null &&
              last.id === coachMessageId
            ) {
              return [
                ...prev.slice(0, -1),
                { ...last, text: coachAccumText, audioUrl: event.audioUrl },
              ];
            }
            const newId = `c-${Date.now()}`;
            coachMessageId = newId;
            return [
              ...prev,
              {
                id: newId,
                role: "coach",
                text: coachAccumText,
                audioUrl: event.audioUrl,
              },
            ];
          });

          audioQueue.enqueue({
            index: event.index,
            text: event.text,
            audioUrl: event.audioUrl,
            durationMs: event.durationMs,
          });
        } else if (event.type === "done") {
          // Replace client coach id with server UUID
          if (coachMessageId && event.messageId) {
            const serverId = event.messageId;
            const localId = coachMessageId;
            setMessages((prev) =>
              prev.map((m) => (m.id === localId ? { ...m, id: serverId } : m)),
            );
          }
        } else if (event.type === "error") {
          const code = event.code as SoftErrorCode;
          if (SOFT_ERROR_CODES.has(code)) {
            pushSoftErrorAsCoachMessage(code);
            await audioQueue.waitForDrain();
            setState({ phase: "idle", conversationId });
            return;
          }
          throw new Error(`${event.code}: ${event.message}`);
        }
      }

      await audioQueue.waitForDrain();
      setState({ phase: "idle", conversationId });
    } catch (err) {
      setState({ phase: "error", message: (err as Error).message });
    }
  }

  async function end() {
    const conversationId = conversationIdRef.current;
    if (!conversationId) return null;
    return endSession(conversationId);
  }

  function dismissError() {
    if (state.phase !== "error") return;
    const conversationId = conversationIdRef.current;
    if (conversationId) {
      setState({ phase: "idle", conversationId });
    } else {
      setState({ phase: "loading-session" });
      void (async () => {
        try {
          const { conversation_id } = await startSession(targetLang);
          conversationIdRef.current = conversation_id;
          setState({ phase: "idle", conversationId: conversation_id });
        } catch (err) {
          setState({ phase: "error", message: (err as Error).message });
        }
      })();
    }
  }

  function toggleListeningMode() {
    setListeningMode((m) => !m);
  }

  function revealMessage(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  return {
    state,
    messages,
    listeningMode,
    revealedIds,
    start,
    stop,
    end,
    dismissError,
    toggleListeningMode,
    revealMessage,
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/mobile"
pnpm typecheck 2>&1 | tail -5
```

Expected: errors only in `practice.tsx` (will fix in Task 19).

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app"
git add apps/mobile/src/features/practice/use-conversation.ts
git commit -m "feat(mobile): rewrite useConversation for greeting + chunks + listening + soft errors (Plan 6)"
```

---

## Phase 6 — Mobile assembly

### Task 19: `practice.tsx` assembly

**Files:**

- Modify: `apps/mobile/app/(tabs)/practice.tsx`

- [ ] **Step 1: Rewrite practice.tsx**

```tsx
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useProfile } from "@/src/features/auth/use-profile";
import { useAudioSessionInit } from "@/src/lib/audio-session";
import { useConversation } from "@/src/features/practice/use-conversation";
import type { ChatMessage } from "@/src/features/practice/types";
import { MessageBubble } from "@/src/features/practice/MessageBubble";
import { MicButton } from "@/src/features/practice/MicButton";
import { TopStatusBar } from "@/src/features/practice/top-status-bar";
import { useSessionTimer } from "@/src/features/practice/use-session-timer";
import { useGoalReward } from "@/src/features/practice/use-goal-reward";
import { GoalReward } from "@/src/features/practice/goal-reward";
import { useTodayStats } from "@/src/features/home/use-today-stats";
import { supabase } from "@/src/lib/supabase";

function useCurrentStreak() {
  return useQuery<number>({
    queryKey: ["current-streak"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("current_streak");
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
}

export default function PracticeScreen() {
  useAudioSessionInit();
  const { data: profile } = useProfile();
  const targetLang = profile?.target_lang ?? "en";
  const displayName = profile?.display_name ?? "there";
  const goalMinutes = profile?.daily_goal_minutes ?? 10;

  const [startedAt] = useState<Date>(() => new Date());

  const {
    state,
    messages,
    listeningMode,
    revealedIds,
    start,
    stop,
    end,
    dismissError,
    toggleListeningMode,
    revealMessage,
  } = useConversation(targetLang, displayName);

  const { data: todayStats } = useTodayStats();
  const { data: streak } = useCurrentStreak();

  const sessionActive =
    state.phase === "idle" ||
    state.phase === "recording" ||
    state.phase === "processing";
  const { seconds: sessionSeconds } = useSessionTimer(sessionActive);

  const todaySecondsAtStartRef = useRef(todayStats?.secondsSpoken ?? 0);
  useEffect(() => {
    if (todayStats && todaySecondsAtStartRef.current === 0) {
      todaySecondsAtStartRef.current = todayStats.secondsSpoken ?? 0;
    }
  }, [todayStats]);

  const todaySeconds = todaySecondsAtStartRef.current + sessionSeconds;
  const goalSeconds = goalMinutes * 60;
  const alreadyReachedToday = todayStats?.goalReached ?? false;

  const { triggered: rewardTriggered, dismiss: dismissReward } = useGoalReward({
    todaySeconds,
    goalSeconds,
    alreadyReachedToday,
  });

  const flatListRef = useRef<FlatList<ChatMessage>>(null);
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [messages.length]);

  const isBusy =
    state.phase === "processing" || state.phase === "loading-session";
  const isRecording = state.phase === "recording";

  const onMicPress = () => {
    if (state.phase === "idle") void start();
    else if (state.phase === "recording") void stop();
  };

  const onExit = () => {
    Alert.alert("End conversation?", undefined, [
      { text: "Keep talking", style: "cancel" },
      {
        text: "End",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await end();
            } catch {
              /* best-effort */
            }
            router.replace("/(tabs)/home");
          })();
        },
      },
    ]);
  };

  if (state.phase === "loading-session") {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Starting conversation…</Text>
      </View>
    );
  }
  if (state.phase === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{state.message}</Text>
        <Pressable onPress={dismissError} style={styles.button}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace("/(tabs)/home")}
          style={[styles.button, styles.buttonSecondary]}
        >
          <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
            Back to Home
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopStatusBar
        todaySeconds={todaySeconds}
        goalMinutes={goalMinutes}
        streakDays={streak ?? 0}
        listeningMode={listeningMode}
        onToggleListening={toggleListeningMode}
        shareLanguageCode={targetLang}
        shareStartedAt={startedAt}
        shareDurationMinutes={Math.floor(
          (Date.now() - startedAt.getTime()) / 60000,
        )}
        shareMessages={messages.map((m) => ({ role: m.role, text: m.text }))}
        onExit={onExit}
      />

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <MessageBubble
            message={item}
            listeningMode={listeningMode}
            revealed={revealedIds.has(item.id)}
            onReveal={revealMessage}
          />
        )}
        contentContainerStyle={styles.chatContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              Tap the mic to start talking with your coach.
            </Text>
          </View>
        }
      />

      <View style={styles.micBar}>
        {state.phase === "processing" && (
          <View style={styles.processingPill}>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.processingText}>Coach is thinking…</Text>
          </View>
        )}
        <MicButton
          onPress={onMicPress}
          isRecording={isRecording}
          isBusy={isBusy}
        />
      </View>

      <GoalReward
        visible={rewardTriggered}
        streakDays={(streak ?? 0) + 1}
        onHidden={dismissReward}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#ffffff" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    padding: 24,
  },
  loadingText: { marginTop: 16, color: "#6b7280" },
  errorText: { color: "#b91c1c", textAlign: "center", marginBottom: 16 },
  chatContainer: { padding: 16, paddingBottom: 120 },
  emptyState: { alignItems: "center", paddingTop: 80, paddingHorizontal: 24 },
  emptyText: { color: "#6b7280", textAlign: "center", fontSize: 14 },
  micBar: {
    position: "absolute",
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  processingPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  processingText: { color: "#374151", marginLeft: 8, fontSize: 13 },
  button: {
    marginTop: 16,
    backgroundColor: "#2563eb",
    borderRadius: 8,
    padding: 14,
    paddingHorizontal: 24,
  },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "600" },
  buttonSecondary: { backgroundColor: "#e5e7eb", marginTop: 8 },
  buttonTextSecondary: { color: "#374151" },
});
```

- [ ] **Step 2: Typecheck + lint**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app"
pnpm typecheck
pnpm lint 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 3: Run mobile tests**

```bash
cd apps/mobile
pnpm test 2>&1 | tail -8
```

Expected: existing tests + new audio-queue + audio-rms tests all pass.

- [ ] **Step 4: Commit + push**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app"
git add "apps/mobile/app/(tabs)/practice.tsx"
git commit -m "feat(mobile): assemble practice.tsx with TopStatusBar + GoalReward + new useConversation (Plan 6)"
git push
```

---

## Phase 7 — Final build

### Task 20: Trigger EAS dev build + final cleanup

**Files:**

- Update: memory + CLAUDE.md

- [ ] **Step 1: Trigger EAS dev build**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app/apps/mobile"
eas build --profile development --platform android --non-interactive
```

This builds because `react-native-confetti-cannon` is a new native module (small one). Wait for the build URL — it'll take 10-20 min via EAS Cloud. Capture the build ID.

- [ ] **Step 2: Update CLAUDE.md status**

Edit `C:\Users\bruno.moise\My Language Coach - rebuild\CLAUDE.md` and bump the status line to "Plans 1-6 done; Plan 7 (visual identity + polish) and Plan 8 (engagement + monetization + release) pending."

- [ ] **Step 3: Update memory**

Edit `C:/Users/bruno.moise/.claude/projects/C--Users-bruno-moise-My-Language-Coach---rebuild/memory/project_language_coach_rebuild.md` and add a Plan 6 status line + key learnings.

- [ ] **Step 4: Update README.md**

In `apps/README.md`, mark Plan 6 as ✓ done in the status table.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/bruno.moise/My Language Coach - rebuild/app"
git add README.md
git commit -m "docs(README): mark Plan 6 done"
git push
```

---

## Done criteria

- All 20 tasks committed.
- CI + Deploy green.
- EAS dev build available — Bruno installs the new APK and runs the manual checklist:
  - Greeting plays in target lang on session start.
  - Timer ticks live in the top bar; updates daily progress optimistically.
  - Streak shows in top bar.
  - Listening toggle hides text → bubbles show 🎧 + duration; tapping reveals + plays.
  - Per-message 🔁 replays coach audio (and own audio within the same session).
  - Audio-silent recording produces an inline coach "didn't catch that" message instead of a red error screen.
  - Daily-goal reward fires once per calendar day (confetti + sound + toast); doesn't fire again same day.
  - Per-sentence streaming TTS makes first audio arrive in ~2s instead of ~5s; text appears in lockstep with audio.
  - No regressions to Plan 5 features (translate, share, profile editing, home, progress).

---

## Test coverage notes

Same convention as Plan 5: pure logic and route handlers tested via Vitest; UI components covered by manual on-device validation (RNTL+Vitest still broken in this monorepo).

Tested with Vitest:

- `sentence-buffer.test.ts`
- `greetings.test.ts`
- `coach-fallbacks.test.ts`
- `audio-queue.test.ts`
- `audio-rms.test.ts`
- `voice-greeting.test.ts`
- `messages.test.ts` (extended)
- `voice-turn.test.ts` (rewritten)

NOT tested (covered manually):

- `TopStatusBar` (visual)
- `GoalReward` (visual + audio playback)
- `MessageBubble` (interaction-heavy, but state machine mirrors quote-card / message tap)
- `useSessionTimer` (trivial useEffect+setInterval)
- `useConversation` keystone (covered by manual end-to-end on-device test)
