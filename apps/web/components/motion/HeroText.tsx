"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

// Long, soft ease-out for an elegant glide (not a snap).
const EASE = [0.16, 1, 0.3, 1] as const;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.18, delayChildren: 0.1 } },
};

// Each line rises + fades + comes into focus from a soft blur.
const item: Variants = {
  hidden: { opacity: 0, y: 26, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.95, ease: EASE },
  },
};

type Props = {
  eyebrow: string;
  painQuote: string;
  headline: string;
  headlineAccent: string;
  subheadline: string;
};

export function HeroText({
  eyebrow,
  painQuote,
  headline,
  headlineAccent,
  subheadline,
}: Props) {
  const reduce = useReducedMotion();

  const eyebrowCls =
    "font-body text-xs uppercase tracking-[0.18em] text-accent-deep pt-12 lg:pt-0";
  const quoteCls =
    "font-display italic text-lg md:text-xl text-ink-soft border-l-2 border-accent/50 pl-4 max-w-md";
  const headlineCls =
    "font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-[1.05] text-ink";
  const subCls = "font-body text-base md:text-lg text-ink-soft max-w-md";

  if (reduce) {
    return (
      <div className="space-y-5 md:space-y-6">
        <p className={eyebrowCls}>{eyebrow}</p>
        <p className={quoteCls}>&ldquo;{painQuote}&rdquo;</p>
        <h1 className={headlineCls}>
          {headline}
          <br />
          <span className="text-accent">{headlineAccent}</span>
        </h1>
        <p className={subCls}>{subheadline}</p>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-5 md:space-y-6"
      variants={container}
      initial="hidden"
      animate="show"
    >
      <motion.p variants={item} className={eyebrowCls}>
        {eyebrow}
      </motion.p>
      <motion.p variants={item} className={quoteCls}>
        &ldquo;{painQuote}&rdquo;
      </motion.p>
      <motion.h1 variants={item} className={headlineCls}>
        {headline}
        <br />
        <span className="text-accent">{headlineAccent}</span>
      </motion.h1>
      <motion.p variants={item} className={subCls}>
        {subheadline}
      </motion.p>
    </motion.div>
  );
}
