"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { PhoneFrame } from "../PhoneFrame";

const EASE = [0.22, 1, 0.36, 1] as const;

const PHONES = [
  {
    src: "/screens/home.jpeg",
    alt: "Home screen",
    widthClass: "hidden sm:block w-[140px] md:w-[170px] lg:w-[200px]",
    rotate: -4,
    float: 0,
  },
  {
    src: "/screens/practice.jpeg",
    alt: "Practice screen",
    widthClass: "w-[180px] sm:w-[180px] md:w-[210px] lg:w-[240px]",
    rotate: 0,
    float: 1,
  },
  {
    src: "/screens/progress.jpeg",
    alt: "Progress screen",
    widthClass: "hidden sm:block w-[140px] md:w-[170px] lg:w-[200px]",
    rotate: 4,
    float: 2,
  },
];

/** Phone mockups: staggered entrance, gentle infinite float, scroll parallax. */
export function HeroPhones() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [36, -36]);

  return (
    <motion.div
      ref={ref}
      style={{ y }}
      className="relative flex justify-center items-center"
    >
      <div className="flex gap-2 sm:gap-4 items-end justify-center w-full">
        {PHONES.map((p, i) => (
          <motion.div
            key={p.src}
            initial={reduce ? false : { opacity: 0, y: 32, scale: 0.96 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.12 * i, ease: EASE }}
          >
            <motion.div
              animate={reduce ? undefined : { y: [0, -8, 0] }}
              transition={{
                duration: 4 + p.float,
                repeat: Infinity,
                ease: "easeInOut",
                delay: p.float * 0.5,
              }}
            >
              <PhoneFrame
                src={p.src}
                alt={p.alt}
                widthClass={p.widthClass}
                rotate={p.rotate}
                priority
              />
            </motion.div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
