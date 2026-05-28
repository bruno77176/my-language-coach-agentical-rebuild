import Image from "next/image";

interface PhoneFrameProps {
  src: string;
  alt: string;
  /** Tailwind width class for the phone, e.g. "w-[240px]" */
  widthClass?: string;
  /** Optional rotation degrees for casual stacking */
  rotate?: number;
  className?: string;
  priority?: boolean;
}

export function PhoneFrame({
  src,
  alt,
  widthClass = "w-[260px]",
  rotate = 0,
  className = "",
  priority = false,
}: PhoneFrameProps) {
  return (
    <div
      className={`relative ${widthClass} aspect-[9/19] rounded-[36px] border-[6px] border-ink/90 bg-ink/90 shadow-floating overflow-hidden ${className}`}
      style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 1024px) 260px, 320px"
        className="object-cover"
        priority={priority}
      />
    </div>
  );
}
