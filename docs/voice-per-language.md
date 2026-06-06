# Voice per language (ElevenLabs)

**Last updated:** 2026-06-06

The coach voice is chosen per target language in
`apps/api/src/providers/voice-map.ts` (`VOICE_BY_LANGUAGE`). It is wired into
`apps/api/src/providers/tts-router.ts`:

```
voice config = explicit per-user config  ??  voiceConfigForLanguage(languageCode)  ??  DEFAULT_TTS_CONFIG
```

So Live mode (no per-user config) gets the per-language native voice; push-to-talk
keeps any per-user choice. All voices use ElevenLabs model `eleven_flash_v2_5`
(multilingual, with `languageCode` pinning pronunciation).

## Which languages have a NATIVE voice today

Only **German, Spanish, English** have a native-speaker voice in the account.
**French, Italian, Japanese, Korean, Chinese, Swedish, Danish, Russian,
Romanian, Hungarian, Turkish, Portuguese have NONE** — they need a native voice
added from the ElevenLabs Voice Library before they can be wired.

| Lang                                           | Status       | Voice ID wired          | Voice                         |
| ---------------------------------------------- | ------------ | ----------------------- | ----------------------------- |
| de                                             | ✅ native    | `7eVMgwCnXydb3CikjV7a`  | Lea - Clear and Feminine      |
| es                                             | ✅ native    | `Ir1QNHvhaJXbAGhT50w3`  | Sara Martin - Light, Intimate |
| en                                             | ✅ native    | `EXAVITQu4vr4xnSDxMaL`  | Sarah - Mature, Reassuring    |
| fr, it, ja, ko, zh, sv, da, ru, ro, hu, tr, pt | ❌ no native | (falls back to default) | needs a Library voice         |

## All 28 voices currently in the account

### German (native)

| Voice ID               | Name                        |
| ---------------------- | --------------------------- |
| `7eVMgwCnXydb3CikjV7a` | Lea - Clear and Feminine    |
| `M39iqBUcu1jyiwM5PfSy` | Lea - Genuine and Soothing  |
| `rAmra0SCIYOxYmRNDSm3` | Lana Weiss - Soft and Sweet |
| `LB5G0Z4EP98YaEgL654m` | Laura - Upbeat & Energetic  |
| `uvysWDLbKpA4XvpD3GI6` | Leonie - Clear and Engaging |

### Spanish (native)

| Voice ID               | Name                                     |
| ---------------------- | ---------------------------------------- |
| `Ir1QNHvhaJXbAGhT50w3` | Sara Martin - Light, Intimate and Tender |
| `gD1IexrzCvsXPHUuT0s3` | Sara Martin - Young and Reflective       |

### English (native)

| Voice ID               | Name                               | Accent     |
| ---------------------- | ---------------------------------- | ---------- |
| `EXAVITQu4vr4xnSDxMaL` | Sarah - Mature, Reassuring         | American   |
| `hpp4J3VqNfWAUOO0d1Us` | Bella - Professional, Bright, Warm | American   |
| `CwhRBWXzGAHq8TQ4Fs17` | Roger - Laid-Back, Casual          | American   |
| `FGY2WhTYpPnrIDTdsKH5` | Laura - Enthusiast, Quirky         | American   |
| `IKne3meq5aSn9XLyUdCD` | Charlie - Deep, Confident          | Australian |
| `JBFqnCBsd6RMkjVDRZzb` | George - Warm Storyteller          | British    |
| `N2lVS1w4EtoT3dr4eOWO` | Callum - Husky Trickster           | American   |
| `SAz9YHcvj6GT2YYXdXww` | River - Relaxed, Neutral           | American   |
| `SOYHLrjzK2X1ezoPC6cr` | Harry - Fierce Warrior             | American   |
| `TX3LPaxmHKxFdv7VOQHJ` | Liam - Energetic Creator           | American   |
| `Xb7hH8MSUJpSbSDYk0k2` | Alice - Clear Educator             | British    |
| `XrExE9yKIg1WjnnlVkGX` | Matilda - Professional             | American   |
| `bIHbv24MWmeRgasZH58o` | Will - Relaxed Optimist            | American   |
| `cgSgspJ2msm6clMCkdW9` | Jessica - Playful, Bright, Warm    | American   |
| `cjVigY5qzO86Huf0OWal` | Eric - Smooth, Trustworthy         | American   |
| `iP95p4xoKVk53GoZ742B` | Chris - Charming, Down-to-Earth    | American   |
| `nPczCjzI2devNBz1zQrb` | Brian - Deep, Comforting           | American   |
| `onwK4e9ZLuTAKqWW03F9` | Daniel - Steady Broadcaster        | British    |
| `pFZP5JQG7iQjIQuC4Bku` | Lily - Velvety Actress             | British    |
| `pNInz6obpgDQGcFmaJgB` | Adam - Dominant, Firm              | American   |
| `pqHfZKP75CvOlQylNhV4` | Bill - Wise, Mature, Balanced      | American   |

## How to find a voice ID

- **UI:** ElevenLabs → **Voices** → click a voice → its card shows **Voice ID**
  (copy button). Or the `⋯` menu → **Copy Voice ID**.
- **API (what we used):** `GET https://api.elevenlabs.io/v2/voices` with header
  `xi-api-key: <key>`. Each voice has `voice_id`, `name`, `labels.language`
  (native language), `labels.accent`, and `verified_languages`.

## How to add a native voice for a new language (e.g. French, Italian)

1. ElevenLabs → **Voices** → **+** / **Voice Library** (Explore).
2. Filter **Language = French** (or Italian, etc.).
3. Pick a native-speaker voice you like → **Add to my voices**.
4. Copy its **Voice ID**.
5. Add a line to `VOICE_BY_LANGUAGE` in `voice-map.ts`, e.g.
   `fr: el("<voiceId>"), // <voice name> — native French`.
6. Deploy the API (server-only change; no mobile rebuild).
