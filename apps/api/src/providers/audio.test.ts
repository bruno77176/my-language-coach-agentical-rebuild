import { describe, it, expect } from "vitest";
import { pcmToWav } from "./audio";

describe("pcmToWav", () => {
  it("prepends a 44-byte RIFF/WAVE header", () => {
    const pcm = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);
    const wav = pcmToWav(pcm);
    expect(wav.byteLength).toBe(44 + pcm.byteLength);
    expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
    expect(wav.toString("ascii", 36, 40)).toBe("data");
    // PCM payload is preserved after the header.
    expect(wav.subarray(44).equals(pcm)).toBe(true);
  });

  it("writes sample rate and byte rate for 24kHz mono 16-bit", () => {
    const wav = pcmToWav(Buffer.from([0, 0, 0, 0]));
    expect(wav.readUInt32LE(24)).toBe(24000); // sample rate
    expect(wav.readUInt16LE(22)).toBe(1); // channels
    expect(wav.readUInt16LE(34)).toBe(16); // bits per sample
    expect(wav.readUInt32LE(28)).toBe(24000 * 1 * 2); // byte rate
  });
});
