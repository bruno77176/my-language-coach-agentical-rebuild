export const palette = {
  peach: "#fde7d1",
  coral: "#f6c7b1",
  mauve: "#d9b4c7",
  accent: "#d96b5b",
  accentDeep: "#a04130",
  ink: "#2b1d12",
  inkSoft: "#3a2520",
  cream: "#fbf6ec",
  white: "#ffffff",
  glass: "rgba(255, 255, 255, 0.55)",
  glassStrong: "rgba(255, 255, 255, 0.7)",
  glassFaint: "rgba(255, 255, 255, 0.35)",
  danger: "#b91c1c",
  dangerSurface: "#fee2e2",
  shadowTint: "rgba(43, 29, 18, 0.28)",
} as const;

export const gradients = {
  sunrise: ["#fde7d1", "#f6c7b1", "#d9b4c7"] as const,
  warmth: ["rgba(255,255,255,0.55)", "rgba(255,255,255,0)"] as const,
  glow: ["rgba(217,107,91,0.18)", "rgba(217,107,91,0)"] as const,
} as const;

export const surface = {
  primary: palette.peach,
  glass: palette.glass,
  glassStrong: palette.glassStrong,
  inkOnLight: palette.ink,
  lightOnInk: palette.peach,
} as const;
