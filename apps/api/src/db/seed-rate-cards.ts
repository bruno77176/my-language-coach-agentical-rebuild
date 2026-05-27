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
  // OpenAI TTS-1 (currently used in voice loop)
  {
    provider: "openai",
    operation: "tts:tts-1",
    unitType: "characters",
    pricePerUnit: "0.000015", // $15 / 1M chars
  },
  // Deepgram Nova-3 (current STT)
  {
    provider: "deepgram",
    operation: "transcribe:nova-3",
    unitType: "seconds",
    pricePerUnit: "0.0000072", // $0.0043/min for nova-3 pay-as-you-go ≈ $0.0000717/s
    // NOTE: verify against your billing — Deepgram tiers change.
  },
  // ElevenLabs TTS (when re-enabled)
  {
    provider: "elevenlabs",
    operation: "tts:eleven_multilingual_v2",
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
