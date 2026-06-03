# TTS Model Landscape & Pricing — May 2026

> **Source:** Transcript of a research conversation between Bruno and Claude (captured 2026-05-28).
> **Purpose:** Baseline reference for improving the in-app conversation/voice experience and for
> deciding which TTS providers to offer in the Voice Lab. Pairs with the "never marry one model"
> benchmarking thread — treat Elo positions as a snapshot, not gospel; quality is subjective and
> leaderboards shift frequently.

---

## TL;DR rankings (Artificial Analysis Speech Arena, blind human-preference Elo, May 2026)

The most reliable live ranking is the **Artificial Analysis Speech Arena**
(<https://artificialanalysis.ai/text-to-speech/leaderboard>), which ranks ~80 models by blind
pairwise human votes and refreshes daily. Cross-referenced with **TTS Arena v2**
(<https://tts-agi-tts-arena-v2.hf.space>).

### Top tier — proprietary

| # | Model | Quality Elo | Price (normalized) | Notes / Source |
|---|-------|-------------|--------------------|----------------|
| 1 | **Google Gemini 3.1 Flash TTS** | ~1,219 | $1 / 1M input text tokens + $20 / 1M output audio tokens (25 tok/s audio) ≈ **$0.03/min** | Current #1; one of the cheapest premium options. <https://ai.google.dev/pricing> |
| 2 | **Inworld TTS 1.5 Max** | ~1,217 | $0.01/min ≈ **$10 / 1M chars** (Mini: $5/1M; enterprise as low as $10/1M Max, $5/1M Mini) | Also tops the real-time leaderboard. <https://inworld.ai/pricing> |
| 3 | **xAI Text to Speech** | (frontier) | No clean published per-char rate | Strong quality-for-price. <https://x.ai/api> |
| 4 | **MiniMax Speech 2.6/2.8 HD** | ~1,156 | ~$40–50 / 1M chars (credit-based; HD listed as high as $100/M by some trackers) | <https://www.minimax.io> |
| 5 | **OpenAI Realtime / gpt-4o-mini-tts** | ~1,106 | ~$12/M (mini-tts), $15/M (tts-1), $30/M (tts-1-hd) | <https://platform.openai.com/docs/guides/text-to-speech> |
| 6 | **ElevenLabs v3** | just outside top 5 | Multilingual v3 ~$206/1M; Flash v2.5 ~$103/1M; overage $0.30/1k chars (Creator) → $0.12 (Business) | Largest voice library; realism benchmark. <https://elevenlabs.io/pricing> |
| 7 | **Speechify SIMBA 3.0** | ~1,159 | **$10 / 1M chars** — cheapest in the top 10 | #7 of 76 per company PR (weight accordingly). <https://speechify.com> |
| 8 | **Cartesia Sonic 3** | ~1,054 | ~$0.03/min (1 credit/char) | Fastest TTFA (~40–90ms). <https://cartesia.ai> |
| 9 | **Hume AI Octave 2** | emotion-focused | **$7.60 / 1M chars** — among cheapest managed | <https://hume.ai> |
| — | **Deepgram Aura-2** | ultra-low latency (<90ms) | $30/1M → $27/1M at volume | <https://deepgram.com> |
| — | **Amazon Polly / Google Cloud Standard** | mid-pack | Polly Standard $4/M, Neural ~$16/M; GCP Standard $4/1M, WaveNet/Neural2 ~$16/1M | Cheapest hyperscalers. <https://aws.amazon.com/polly>, <https://cloud.google.com/text-to-speech> |
| — | Microsoft Azure / NVIDIA Magpie | mid-pack quality | — | Established enterprise providers. |

### Best open-weight models (free to self-host; price = cheapest hosted endpoint)

| # | Model | Quality Elo | Price | Notes |
|---|-------|-------------|-------|-------|
| 1 | **Fish Audio S2 Pro** | ~1,124 | $15 / 1M UTF-8 bytes (~$0.80/hr) | Highest-ranked open model overall. <https://fish.audio> |
| 2 | **Step Audio EditX** | ~1,112 | self-host | open weights |
| 3 | **Voxtral TTS** | ~1,077 | self-host | open weights |
| 4 | **Kokoro 82M v1.0** | ~1,060 | **$0.70 / 1M chars** (cheapest on leaderboard) | Apache 2.0; runs on consumer HW; best price-performance. <https://huggingface.co/hexgrad/Kokoro-82M> |
| 5 | **NVIDIA Magpie-Multilingual 357M** | ~1,060 | self-host | <https://huggingface.co/nvidia> |
| — | IndexTTS-2 / CosyVoice2-0.5B / Fish Speech 1.5 | strong | free on own GPU | good self-host options |
| — | StyleTTS 2 | — | $2.82 / 1M chars hosted | open weights |

---

## Value takeaways

- **Best quality-per-dollar at the top:** Gemini 3.1 Flash TTS (~$0.03/min) or Inworld ($10/1M).
- **Cheapest managed:** Hume Octave 2 ($7.60/1M).
- **Cheapest overall:** Kokoro 82M ($0.70/1M, or free self-hosted).
- **Realism benchmark (priciest):** ElevenLabs v3.
- For a real decision, **latency, price, language coverage, and voice-cloning** matter as much as raw
  Elo. Open models (Fish Audio, Kokoro, IndexTTS-2) are the self-hostable ones.

### Caveats
- Vendors price in different units (per 1M chars, per 1M tokens, per minute, subscription credits);
  per-1M-char figures for token/minute-billed models are approximate conversions.
- Most vendors discount 20–40% at volume.
- Speechify's "#7" claims come from its own press releases.

---

## Who is Inworld? (the surprise #2)

A **US (San Francisco Bay Area — Mountain View / Palo Alto) voice & AI-infrastructure startup**,
founded **2021** by **Ilya Gelfenbeyn, Kylan Gibbs, and Michael Ermolenko**.

- **Pedigree:** founding team led LLM product at DeepMind and built **Dialogflow** (formerly API.AI /
  SpeakToIt, acquired by Google — now powers Google Assistant's conversational layer). Gelfenbeyn was
  CEO, Ermolenko Head of AI at API.AI.
- **Origin:** started in **gaming** — the "Character Engine" for real-time generative AI NPCs (memory,
  emotion, multimodal) on Unreal/Unity.
- **Pivot:** now a **real-time voice AI infrastructure** company — realtime voice models, model
  routing, a Realtime API. Their Realtime TTS / TTS-1.5 line is what tops the AA Speech Arena.
- **Funding:** **$125M+** from Lightspeed, Kleiner Perkins, Founders Fund, CRV, Stanford, Microsoft
  M12, Meta, Intel Capital, Samsung NEXT, LG Tech Ventures, Bitkraft. A $50M round (Aug 2023) valued
  them at **$500M**. Angels: Kevin Lin (Twitch), Nate Mitchell (Oculus), Yat Siu (Animoca).
- **Clients:** reportedly Xbox, Ubisoft, Shiseido.
- **Caveat:** their marketing leans hard on leaderboard rankings — test their voices against our
  actual use case before trusting Elo alone.

---

## Primary sources for live rankings

- **Artificial Analysis Speech Arena** — <https://artificialanalysis.ai/text-to-speech/leaderboard>
  (most rigorous; daily refresh; Elo + speed + price on one chart at
  <https://artificialanalysis.ai/text-to-speech/models>)
- **Hugging Face TTS Arena v2** — <https://tts-agi-tts-arena-v2.hf.space>
- **Magic Hour consensus table** — <https://magichour.ai/model-leaderboard/text-to-speech>
- **BuildMVPFast per-volume cost calculator** — <https://www.buildmvpfast.com/api-costs/ai-voice>

---

## Decisions this informs

- **Voice Lab provider additions (in progress 2026-06-03):** add **Gemini 3.1 Flash TTS** and
  **Inworld** alongside existing OpenAI + ElevenLabs, so we can A/B real voices in-app.
- Open-model self-hosting (Kokoro / Fish Audio) as a future cost lever for a free tier.
