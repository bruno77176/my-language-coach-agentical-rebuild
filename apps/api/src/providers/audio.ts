// Wrap raw little-endian PCM samples in a canonical 44-byte WAV header so the
// audio is directly playable (expo-av plays audio/wav on iOS + Android).
// Gemini TTS returns signed 16-bit LE PCM (default 24kHz mono).
export function pcmToWav(
  pcm: Buffer,
  opts: { sampleRate?: number; channels?: number; bitsPerSample?: number } = {},
): Buffer {
  const sampleRate = opts.sampleRate ?? 24000;
  const channels = opts.channels ?? 1;
  const bitsPerSample = opts.bitsPerSample ?? 16;

  const blockAlign = (channels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm.byteLength;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // audio format = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}
