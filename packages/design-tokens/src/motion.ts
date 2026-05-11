export const motion = {
  duration: {
    fast: 150,
    base: 250,
    slow: 450,
    intro: 1800,
  },
  spring: {
    gentle: { damping: 18, stiffness: 120, mass: 1 },
    decisive: { damping: 22, stiffness: 200, mass: 1 },
  },
  bezier: {
    out: [0.16, 1, 0.3, 1] as const,
    spring: [0.34, 1.56, 0.64, 1] as const,
  },
} as const;
