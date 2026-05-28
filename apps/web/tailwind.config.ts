import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";
import { palette, radius } from "@language-coach/design-tokens";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx,mdx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.{md,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        peach: palette.peach,
        coral: palette.coral,
        mauve: palette.mauve,
        accent: palette.accent,
        "accent-deep": palette.accentDeep,
        ink: palette.ink,
        "ink-soft": palette.inkSoft,
        cream: palette.cream,
      },
      backgroundImage: {
        sunrise: `linear-gradient(135deg, ${palette.peach} 0%, ${palette.coral} 50%, ${palette.mauve} 100%)`,
        warmth:
          "linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)",
      },
      borderRadius: {
        sm: `${radius.sm}px`,
        md: `${radius.md}px`,
        lg: `${radius.lg}px`,
        xl: `${radius.xl}px`,
        pill: `${radius.pill}px`,
      },
      spacing: {
        "section-y": "96px",
        "section-y-lg": "128px",
      },
      maxWidth: {
        content: "1140px",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        body: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 12px rgba(43, 29, 18, 0.06)",
        floating: "0 8px 24px rgba(43, 29, 18, 0.12)",
        cta: "0 10px 20px rgba(43, 29, 18, 0.28)",
      },
    },
  },
  plugins: [typography],
};

export default config;
