export const font = {
  display: "Fraunces_500Medium",
  displayBold: "Fraunces_700Bold",
  displayItalic: "Fraunces_500Medium_Italic",
  body: "DMSans_400Regular",
  bodyMedium: "DMSans_500Medium",
  bodyBold: "DMSans_700Bold",
} as const;

export const type = {
  displayXl: {
    fontFamily: font.display,
    fontSize: 36,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  displayLg: {
    fontFamily: font.display,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  displayMd: {
    fontFamily: font.display,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.3,
  },
  italic: { fontFamily: font.displayItalic, fontStyle: "italic" as const },
  bodyLg: { fontFamily: font.body, fontSize: 16, lineHeight: 22 },
  bodyMd: { fontFamily: font.body, fontSize: 14, lineHeight: 20 },
  bodySm: { fontFamily: font.body, fontSize: 12, lineHeight: 16 },
  caps: {
    fontFamily: font.bodyBold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase" as const,
  },
} as const;
