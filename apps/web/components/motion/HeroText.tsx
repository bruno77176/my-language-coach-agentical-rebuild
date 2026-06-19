import type { CSSProperties } from "react";

type Props = {
  eyebrow: string;
  painQuote: string;
  headline: string;
  headlineAccent: string;
  subheadline: string;
};

// Staggered fade+rise, driven entirely by the `.hero-rise` CSS keyframe in
// globals.css. This is intentionally NOT a framer-motion / JS animation: the
// text must stay visible even if the JS bundle fails to run (e.g. an older
// Safari). The keyframe holds each line hidden for its delay, then rises it in;
// reduced-motion and unsupported browsers fall back to plain visible text.
export function HeroText({
  eyebrow,
  painQuote,
  headline,
  headlineAccent,
  subheadline,
}: Props) {
  // Matches the previous stagger: 0.1s lead + 0.18s between lines.
  const rise = (i: number): CSSProperties => ({
    animationDelay: `${0.1 + i * 0.18}s`,
  });

  const eyebrowCls =
    "hero-rise font-body text-xs uppercase tracking-[0.18em] text-accent-deep pt-12 lg:pt-0";
  const quoteCls =
    "hero-rise font-display italic text-lg md:text-xl text-ink-soft border-l-2 border-accent/50 pl-4 max-w-md";
  const headlineCls =
    "hero-rise font-display text-3xl sm:text-4xl md:text-5xl lg:text-6xl leading-[1.05] text-ink";
  const subCls =
    "hero-rise font-body text-base md:text-lg text-ink-soft max-w-md";

  return (
    <div className="space-y-5 md:space-y-6">
      <p className={eyebrowCls} style={rise(0)}>
        {eyebrow}
      </p>
      <p className={quoteCls} style={rise(1)}>
        &ldquo;{painQuote}&rdquo;
      </p>
      <h1 className={headlineCls} style={rise(2)}>
        {headline}
        <br />
        <span className="text-accent">{headlineAccent}</span>
      </h1>
      <p className={subCls} style={rise(3)}>
        {subheadline}
      </p>
    </div>
  );
}
