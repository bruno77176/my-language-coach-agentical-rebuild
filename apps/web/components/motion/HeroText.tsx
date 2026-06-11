"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.08 } },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

// The headline reveals word-by-word — the "text appears progressively" effect.
const wordGroup: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const word: Variants = {
  hidden: { opacity: 0, y: "0.4em" },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
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
  const words = headline.split(" ");

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
      <motion.p variants={fadeUp} className={eyebrowCls}>
        {eyebrow}
      </motion.p>
      <motion.p variants={fadeUp} className={quoteCls}>
        &ldquo;{painQuote}&rdquo;
      </motion.p>
      <motion.h1 variants={wordGroup} className={headlineCls}>
        {words.map((w, i) => (
          <motion.span
            key={i}
            variants={word}
            className="inline-block whitespace-pre"
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        ))}
        <br />
        <motion.span variants={word} className="inline-block text-accent">
          {headlineAccent}
        </motion.span>
      </motion.h1>
      <motion.p variants={fadeUp} className={subCls}>
        {subheadline}
      </motion.p>
    </motion.div>
  );
}
