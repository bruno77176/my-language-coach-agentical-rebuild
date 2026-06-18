import { describe, expect, it } from "vitest";
import { generateQrSvg } from "./qr";

describe("generateQrSvg", () => {
  it("returns SVG markup for a URL", async () => {
    const svg = await generateQrSvg("https://example.com");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("encodes the URL into the QR (lengths differ for different inputs)", async () => {
    const short = await generateQrSvg("a");
    const long = await generateQrSvg(
      "https://apps.apple.com/app/id6746396786-very-long-suffix-to-force-larger-qr",
    );
    expect(long.length).toBeGreaterThan(short.length);
  });

  it("uses a coral accent color for the foreground", async () => {
    const svg = await generateQrSvg("https://example.com", {
      color: "#d96b5b",
    });
    expect(svg).toContain("#d96b5b");
  });
});
