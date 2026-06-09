# Conversation latency — full analysis and plan to make the voice loop fast

**Date:** 2026-06-04
**Author:** Claude (at Bruno's request)
**Why:** The in-app conversation feels far too slow — too much latency between messages. This is the core of the product (a real-time voice coach), so it must improve drastically. This doc puts **all options on the table**, then recommends a sequenced plan: optimize the current pipeline first, then the realtime leap.

> ⚠️ Latency numbers are estimates from a full code read + 2026 provider benchmarks, not production measurements. The first implementation step is to **instrument real timings** so we tune against data, not guesses.

---

## 1. How the voice loop works today

It's a **turn-based / push-to-talk** loop:

1. User taps mic, talks, taps again to stop → the app records **one full audio clip**.
2. The clip is uploaded to the API (single Fly machine, Stockholm).
3. **STT** (Deepgram nova-3) transcribes the whole clip.
4. **LLM** (OpenAI gpt-4o-mini) streams the coach reply token-by-token.
5. **TTS** synthesizes the reply — already **pipelined**: each finished sentence is sent to TTS immediately while the LLM keeps writing.
6. Each audio chunk is **uploaded to Supabase Storage**, a signed URL is created, and that URL is sent to the client.
7. The client **downloads** each chunk from its URL and plays them back-to-back.

**Two things are already done right:** TTS is pipelined with the LLM (we don't wait for the full reply before speaking), and the client plays the first chunk as soon as it arrives. So this is **not** a rewrite — it's about removing serialized waits.

---

## 2. The diagnosis — where ~3 seconds go

"Latency between messages" = **time to first audio (TTFA)**: from the moment you stop talking to the moment the coach starts speaking. Critical path, with the real serialized waits found in the code:

| Stage                                                                      | Cost        | Where                                |
| -------------------------------------------------------------------------- | ----------- | ------------------------------------ |
| Client: stop recording + POST round-trip                                   | 50–200 ms   | `api-client.ts`                      |
| Server: **auth network call** to Supabase, every turn                      | 50–200 ms   | `middleware/auth.ts:25`              |
| Server: **4 sequential DB queries** (conversation, quota, profile, memory) | 40–120 ms   | `routes/voice.ts:157–247`            |
| Server: **STT in BATCH** (whole clip uploaded, then transcribed)           | 300–1500 ms | `providers/deepgram.ts:49`           |
| Server: save user message + **load FULL unbounded history**                | 40–300 ms   | `voice.ts:293,300`                   |
| Server: LLM to first sentence (streamed)                                   | 200–800 ms  | `providers/openai.ts`                |
| Server: **TTS + upload to Storage + sign URL** (2 network calls) per chunk | 400–1500 ms | `voice.ts:361` → `lib/storage.ts:59` |
| Client: **re-download** chunk from URL, decode, play                       | 50–300 ms   | `audio-controller.ts:75`             |

**Total ≈ 2–3.5 s before the first word.**

### The biggest removable costs

1. 🔴 **The Storage round-trip on the audio path.** Every audio chunk is uploaded to Supabase + signed (2 network calls), THEN the client downloads it back. That's a full extra round-trip per chunk that adds **nothing** to the experience. Biggest single waste.
2. 🔴 **Gemini as the default TTS voice.** Gemini is a non-streaming REST call — you wait for the whole sentence's audio before any sound plays. Great quality, bad for latency.
3. 🟠 **Per-turn auth network call** to Supabase (also the cause of the "401 / invalid token" failures under load).
4. 🟠 **Batch STT** — uploading the whole clip then transcribing, instead of streaming while the user talks.
5. 🟡 **Unbounded history** sent to the LLM every turn — grows forever, slows the first token and costs more.

---

## 3. The options — two horizons

### Horizon 1 — Optimize the current pipeline (fast, cheap, low risk)

**Target: ~3 s → ~1.2 s.** No new vendor, mostly server-side.

| #   | Change                                                                                                                                                          | Saves                                      | Effort        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------- |
| 1   | **Send audio inline over the stream** (base64 in the event); do the Storage upload in the background, off the critical path                                     | ~400–900 ms **per chunk, incl. the first** | Medium        |
| 2   | **Switch the default voice to a fast streaming provider** (ElevenLabs Flash ~75 ms, already integrated) and actually stream it; keep Gemini as a premium option | 200–1500 ms on first audio                 | Medium        |
| 3   | **Verify the login token locally** instead of calling Supabase every turn                                                                                       | 50–200 ms/turn + fixes the 401s            | Small         |
| 4   | **Run the 4 startup DB queries in parallel**                                                                                                                    | 60–90 ms                                   | Small         |
| 5   | **Cap the history** sent to the LLM (last N turns + memory summary)                                                                                             | faster first token, lower cost             | Small         |
| 6   | **Move post-turn DB writes to the background** (don't block the turn's end)                                                                                     | snappier turn completion                   | Small         |
| 7   | **Bigger server** (the 256 MB machine starves under light load, adding latency everywhere) + multi-region later                                                 | global consistency                         | Small (infra) |

### Horizon 2 — Streaming capture + realtime "Live" mode (the leap)

**Target: sub-1 s, interruptible.** Planned AFTER Horizon 1.

- **2a. Streaming STT:** the app streams mic audio **while** you talk (Deepgram streaming + voice-activity detection), so the transcript is ready the instant you stop — instead of "record full clip → upload → transcribe". Cuts STT from 300–1500 ms to ~100–300 ms.
- **2b. Realtime speech-to-speech:** a single WebSocket connection that does voice-in → voice-out in **under 500 ms**, with the ability to interrupt the coach (barge-in). Best as a **Pro-tier "Live conversation" mode**, alongside (not replacing) the turn-based loop.

---

## 4. Realtime providers — updated comparison (verified 2026-06-04)

Your earlier research concluded "only Inworld exposes the text transcript" (which we need for corrections, feedback, memory). **That is now outdated** — the native options expose transcripts too:

| Option                            | Latency                   | Exposes text?                          | Cost       | Notes                                                                                         |
| --------------------------------- | ------------------------- | -------------------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| **Optimized cascade (Horizon 1)** | ~1.0–1.4 s                | ✅ authoritative LLM text              | current    | No new vendor, lowest risk                                                                    |
| **Inworld Realtime**              | sub-500 ms voice-to-voice | ✅ yes (clean transcripts)             | ~$0.01/min | Your original lead; strong cost + transcript clarity; concurrency typically ≥4× request limit |
| **OpenAI Realtime**               | lowest                    | ✅ now streams transcript deltas       | higher     | Native audio; transcript is ASR-of-audio (slightly lossy)                                     |
| **Gemini Live**                   | lowest                    | ✅ input + output transcription config | mid        | Native audio; same lossy-transcript caveat                                                    |

**Takeaway:** all three realtime options are now viable for a coach that needs text. Inworld still leads on cost + transcript cleanliness. But **we don't need to pick yet** — Horizon 1 gets most of the felt improvement without committing to a new vendor or new infra.

---

## 5. TTS provider trade-off (the heart of the default-voice question)

| Provider                          | Quality       | **Latency (TTFA)**           | Cost       | Integrated?                 |
| --------------------------------- | ------------- | ---------------------------- | ---------- | --------------------------- |
| **Gemini Kore** (current default) | #1, excellent | ❌ slow (REST, no streaming) | 💚 cheap   | ✅                          |
| **ElevenLabs Flash v2.5**         | very good     | ✅ ~75 ms, streaming         | 🟠 pricier | ✅ (but currently buffered) |
| **Cartesia Sonic 4**              | good          | ✅✅ ~40 ms                  | 🟠 TBD     | ❌                          |
| **OpenAI tts**                    | ok            | ❌ slow                      | mid        | ✅ (fallback)               |

**Recommendation:** for the latency goal, make the default a **streaming low-TTFA** provider — **ElevenLabs Flash v2.5** (already integrated, just stop buffering it) — and keep **Gemini as a selectable "premium quality" voice**. Evaluate **Cartesia** for an even lower floor. ⚠️ ElevenLabs costs more than Gemini, so cross-check against the free/pro economics (free users are already expensive — see the monetization doc); a likely outcome is a **fast default for everyone, Gemini premium as an upgrade**.

---

## 6. Recommended plan & expected result

1. **Do Horizon 1 first** (the table in §3) — biggest felt improvement for the least risk. Order by impact: inline audio (1) → streaming fast TTS (2) → local token verify (3) → parallel queries (4) → history cap (5) → background writes (6) → bigger server (7).
2. **Instrument real timings** before/after each change (don't benchmark on the prod machine — it starves and skews results).
3. **Then decide Horizon 2** — streaming STT is the next biggest cut; the realtime "Live" mode is a Pro feature to choose (Inworld vs native) once Horizon 1 data is in.

**Expected after Horizon 1:** time-to-first-word **~1.0–1.4 s** (from ~3 s), no new vendor, low risk.
**Expected after Horizon 2:** **sub-1 s, interruptible** — competitive with Speak / Babbel-Speak.

---

## 7. Open questions / risks

- Inline audio: confirm the app plays a freshly-written temp clip fast enough (tiny write cost) vs. the old download — measure.
- Streaming ElevenLabs: keep chunk ordering correct so sentences don't overlap.
- Local token verification must still block unconfirmed-email accounts (a past bug).
- History cap must not break coach continuity — lean on the memory summary for older turns.
- The TTS default switch overlaps with the in-flight Voice Lab work and the separate Gemini-GA TTS fix — coordinate so they don't collide.

---

_Companion to the scaling audit (`2026-06-03-scaling-and-bottlenecks-audit.md`), the Inworld S2S investigation (`2026-06-03-inworld-realtime-speech-to-speech-investigation.md`), and the monetization doc. Update once real timings are measured._
