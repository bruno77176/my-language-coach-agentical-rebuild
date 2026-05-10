/**
 * One-off script: generate 12 bundled greeting MP3s using OpenAI TTS.
 *
 * Runs locally with the api/.env. Writes files to:
 *   apps/mobile/assets/sounds/greetings/<lang>.mp3
 *
 * The bundled greetings drop the {name} placeholder — the on-screen text
 * still shows the personalized version, but the audio is generic. This
 * trades personalization for instant + reliable playback.
 *
 * Run: cd apps/api && pnpm tsx --env-file=.env src/db/generate-greeting-audios.ts
 */
/* eslint-disable no-console */
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { loadEnv } from "../env";

const __dirname = dirname(fileURLToPath(import.meta.url));

const GENERIC_GREETINGS: Record<string, string> = {
  en: "Hi! What would you like to talk about today?",
  fr: "Salut ! De quoi veux-tu parler aujourd'hui ?",
  de: "Hallo! Worüber möchtest du heute sprechen?",
  it: "Ciao! Di cosa vuoi parlare oggi?",
  es: "¡Hola! ¿De qué quieres hablar hoy?",
  pt: "Olá! Sobre o que queres falar hoje?",
  tr: "Merhaba! Bugün ne hakkında konuşmak istersin?",
  sv: "Hej! Vad vill du prata om idag?",
  da: "Hej! Hvad vil du tale om i dag?",
  ru: "Привет! О чём хочешь поговорить сегодня?",
  ro: "Bună! Despre ce vrei să vorbim astăzi?",
  hu: "Szia! Miről szeretnél ma beszélni?",
};

async function main() {
  const env = loadEnv();
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  const outDir = resolve(
    __dirname,
    "../../../../apps/mobile/assets/sounds/greetings",
  );
  console.log("Output dir:", outDir);

  for (const [lang, text] of Object.entries(GENERIC_GREETINGS)) {
    console.log(`Generating ${lang}: "${text}"`);
    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: text,
      response_format: "mp3",
    });
    const buf = Buffer.from(await response.arrayBuffer());
    const path = join(outDir, `${lang}.mp3`);
    writeFileSync(path, buf);
    console.log(`  → wrote ${path} (${buf.length} bytes)`);
  }

  console.log("\nDone. 12 greeting MP3s saved.");
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
