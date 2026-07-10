-- Rate-card corrections (verified against live provider pricing pages, 2026-07).
--
-- Two fixes, both to the app's biggest cost line (TTS), and both to COST
-- TRACKING only — they change what the admin dashboard reports, not runtime
-- behavior or actual spend:
--
--   1. ElevenLabs Flash v2.5 was seeded at a $0.00033/char GUESS. The verified
--      marginal API rate is $0.00005/char (~6.6x lower). The dashboard has been
--      overstating every Pro TTS second by 6.6x.
--   2. Google Gemini-TTS (the free-tier "Kore" voice) had NO rate card at all,
--      so cost-recording logged "no rate card" and recorded $0 for every free
--      conversation. This adds it.
--
-- Mechanics: cost-recording.lookupRateCard() selects the row with the latest
-- effective_from whose [effective_from, effective_to) window covers now(). To
-- re-price we close the currently-open row (effective_to = now()) and insert a
-- new row (effective_from = now()); the new row then wins the ORDER BY. now() is
-- the transaction start time, so the close and the open share one instant and
-- there is no gap. Operation strings match exactly what the providers emit
-- (providers/elevenlabs.ts, providers/gemini.ts) so the lookup actually hits.

BEGIN;

-- 1. ElevenLabs Flash v2.5: $0.00033/char guess -> $0.00005/char (verified).
UPDATE rate_cards
   SET effective_to = now()
 WHERE provider = 'elevenlabs'
   AND operation = 'tts:eleven_flash_v2_5'
   AND unit_type = 'characters'
   AND effective_to IS NULL;

INSERT INTO rate_cards (provider, operation, unit_type, price_per_unit, effective_from, notes)
VALUES (
  'elevenlabs', 'tts:eleven_flash_v2_5', 'characters', 0.0000500000, now(),
  'Verified 2026-07: marginal API rate $0.05/1k chars (was a $0.33/1k guess, 6.6x too high). Tiers run $0.05-0.11/1k.'
);

-- 2. Google Gemini-TTS ("Kore", free tier): previously untracked -> add it.
--    Google bills $10 / 1M audio output tokens @ 25 tokens/sec = $0.015/min of
--    audio. The app records CHARACTERS (input.text.length), so convert at a
--    conversational ~13 chars/sec: $0.015/min / (13*60 chars/min) ~= $0.0000192/char
--    (~$19/1M). This conversion is speaking-rate dependent (+/-20%); refine once
--    real usage lands. Provider/operation match providers/gemini.ts exactly.
INSERT INTO rate_cards (provider, operation, unit_type, price_per_unit, effective_from, notes)
VALUES (
  'gemini', 'tts:gemini-2.5-flash-tts', 'characters', 0.0000192000, now(),
  'Verified 2026-07: $10/1M audio tokens @ 25 tok/s; ~13 chars/s => ~$0.0000192/char (~$19/1M). Speaking-rate dependent; refine with real usage.'
)
ON CONFLICT (provider, operation, unit_type, effective_from) DO NOTHING;

COMMIT;
