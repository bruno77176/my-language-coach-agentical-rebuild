import { PhoneFrame } from "./PhoneFrame";

interface ShowcaseMessages {
  eyebrow: string;
  title: string;
  body: string;
  p1: string;
  p2: string;
  p3: string;
}

interface ShowcaseImage {
  src: string;
  alt: string;
}

interface Props {
  messages: ShowcaseMessages;
  images: ShowcaseImage[];
  /** When true, phones render to the right of the copy on desktop. */
  imageRight?: boolean;
  /** Background utility class, e.g. "bg-cream" or "bg-white". */
  background?: string;
}

export function Showcase({
  messages,
  images,
  imageRight = false,
  background = "bg-white",
}: Props) {
  const points = [messages.p1, messages.p2, messages.p3];
  return (
    <section className={`py-section-y ${background}`}>
      <div
        className={`max-w-content mx-auto px-6 grid md:grid-cols-2 gap-12 md:gap-16 items-center ${
          imageRight ? "md:[&>*:first-child]:order-2" : ""
        }`}
      >
        {/* Phones */}
        <div className="flex min-w-0 justify-center items-end gap-4">
          {images.map((img, i) => (
            <PhoneFrame
              key={img.src}
              src={img.src}
              alt={img.alt}
              widthClass={
                images.length > 1
                  ? "w-[130px] sm:w-[180px] md:w-[200px]"
                  : "w-[200px] sm:w-[230px]"
              }
              rotate={images.length > 1 ? (i === 0 ? -4 : 4) : 0}
              className={images.length > 1 && i === 1 ? "-ml-5 sm:-ml-10" : ""}
            />
          ))}
        </div>

        {/* Copy */}
        <div className="space-y-5 min-w-0 text-center md:text-left">
          <p className="font-body text-sm uppercase tracking-widest text-accent-deep">
            {messages.eyebrow}
          </p>
          <h2 className="font-display text-3xl md:text-4xl text-ink">
            {messages.title}
          </h2>
          <p className="font-body text-lg text-ink-soft">{messages.body}</p>
          <ul className="space-y-2 inline-block text-left">
            {points.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 font-body text-base text-ink"
              >
                <span
                  className="mt-1 h-2 w-2 shrink-0 rounded-pill bg-accent"
                  aria-hidden
                />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
