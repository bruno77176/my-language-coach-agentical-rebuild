"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

// Strong, soft ease-out (easeOutExpo-ish) — long, gentle deceleration is what
// reads as "smooth/elegant" rather than a snappy pop.
const EASE = [0.16, 1, 0.3, 1] as const;

type Props = {
  children: ReactNode;
  /** Seconds to wait before animating in. */
  delay?: number;
  className?: string;
};

/**
 * Reveals its children as they scroll into view (once): fade + a gentle rise +
 * a blur-to-focus. The blur is the key to the elegant feel. Honours
 * prefers-reduced-motion (renders static).
 */
export function Reveal({ children, delay = 0, className }: Props) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 32, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "0px 0px -140px 0px" }}
      transition={{ duration: 1, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
