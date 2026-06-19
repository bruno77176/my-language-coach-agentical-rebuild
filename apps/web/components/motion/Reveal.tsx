"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Run the arming layout effect before paint on the client (no flash), but fall
// back to a no-op on the server where useLayoutEffect would warn.
const useIsoLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Props = {
  children: ReactNode;
  /** Seconds to wait before the reveal transition starts. */
  delay?: number;
  className?: string;
};

/**
 * Reveals its children as they scroll into view (once): a fade + a gentle rise.
 *
 * Robustness contract: the element renders VISIBLE by default (class `reveal`,
 * opacity:1). It is only hidden (`reveal-armed`) AFTER this component mounts on
 * the client, then revealed (`reveal-in`) when it scrolls into view. If the JS
 * bundle never runs — the failure that made all text vanish on older Safari —
 * the children simply stay visible with no animation. Honours
 * prefers-reduced-motion (stays visible, no animation).
 */
export function Reveal({ children, delay = 0, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "armed" | "in">("idle");

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Reduced motion: leave it visible, skip the animation entirely.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    // Hide before the browser paints, then reveal on intersection.
    setState("armed");

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setState("in");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -140px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const cls = [
    "reveal",
    state === "armed" ? "reveal-armed" : "",
    state === "in" ? "reveal-in" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={ref}
      className={cls}
      style={delay ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}
