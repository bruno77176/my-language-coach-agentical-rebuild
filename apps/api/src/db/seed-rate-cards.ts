import { sql } from "drizzle-orm";
import { createDb } from "./client";
import { loadEnv } from "../env";

type Seed = {
  provider: string;
  operation: string;
  unitType: string;
  pricePerUnit: string; // USD per single unit
  notes?: string;
};

// Prices verified 2026-05-27. Update via the admin UI for changes — this
// seed only runs to populate an empty rate_cards table.
const SEEDS: Seed[] = [
  // OpenAI gpt-4o-mini
  {
    provider: "openai",
    operation: "chat:gpt-4o-mini",
    unitType: "input_tokens",
    pricePerUnit: "0.00000015", // $0.15 / 1M
  },
  {
    provider: "openai",
    operation: "chat:gpt-4o-mini",
    unitType: "output_tokens",
    pricePerUnit: "0.0000006", // $0.60 / 1M
  },
  // OpenAI gpt-4o
  {
    provider: "openai",
    operation: "chat:gpt-4o",
    unitType: "input_tokens",
    pricePerUnit: "0.0000025", // $2.50 / 1M
  },
  {
    provider: "openai",
    operation: "chat:gpt-4o",
    unitType: "output_tokens",
    pricePerUnit: "0.00001", // $10 / 1M
  },
  // OpenAI Whisper (legacy, only if we still use it)
  {
    provider: "openai",
    operation: "transcribe:whisper-1",
    unitType: "seconds",
    pricePerUnit: "0.0001", // $0.006/min ≈ $0.0001/s
  },
  // OpenAI TTS-1 (kept for historical events; voice loop now uses gpt-4o-mini-tts)
  {
    provider: "openai",
    operation: "tts:tts-1",
    unitType: "characters",
    pricePerUnit: "0.000015", // $15 / 1M chars
  },
  // OpenAI TTS-1-HD (kept for historical events / experimentation)
  {
    provider: "openai",
    operation: "tts:tts-1-hd",
    unitType: "characters",
    pricePerUnit: "0.00003", // $30 / 1M chars
  },
  // OpenAI gpt-4o-mini-tts (current voice loop default — purpose-built
  // multilingual TTS, sounds correct across all 12 supported languages).
  // OpenAI bills this per audio output tokens (~$0.015/min audio).
  // Approximated to ~$0.00006/char based on average speech rate; refine
  // via admin UI once we have actual usage data.
  {
    provider: "openai",
    operation: "tts:gpt-4o-mini-tts",
    unitType: "characters",
    pricePerUnit: "0.00006", // approx — OpenAI's billing is token-based, not per-char
  },
  // Deepgram Nova-3 (current STT)
  {
    provider: "deepgram",
    operation: "transcribe:nova-3",
    unitType: "seconds",
    pricePerUnit: "0.0000072", // $0.0043/min for nova-3 pay-as-you-go ≈ $0.0000717/s
    // NOTE: verify against your billing — Deepgram tiers change.
  },
  // Deepgram Nova-2 (used for Mandarin Chinese — nova-3 lacks zh support)
  {
    provider: "deepgram",
    operation: "transcribe:nova-2",
    unitType: "seconds",
    pricePerUnit: "0.0000072", // mirror nova-3 PAYG; verify against billing
    // NOTE: verify the nova-2 pre-recorded PAYG rate — Deepgram tiers change.
  },
  // ElevenLabs TTS (when re-enabled). Operation name must match the provider's
  // active default in providers/elevenlabs.ts so recordUsage finds a rate card.
  {
    provider: "elevenlabs",
    operation: "tts:eleven_flash_v2_5",
    unitType: "characters",
    pricePerUnit: "0.00033", // ~$0.33/1k chars on Creator tier; verify
  },
];

async function main() {
  const env = loadEnv();
  const db = createDb(env);

  for (const s of SEEDS) {
    await db.execute(sql`
      INSERT INTO rate_cards (provider, operation, unit_type, price_per_unit, effective_from, notes)
      VALUES (${s.provider}, ${s.operation}, ${s.unitType}, ${s.pricePerUnit}, NOW(), ${s.notes ?? null})
      ON CONFLICT (provider, operation, unit_type, effective_from) DO NOTHING
    `);
  }
  console.log(`Seeded ${SEEDS.length} rate cards.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
