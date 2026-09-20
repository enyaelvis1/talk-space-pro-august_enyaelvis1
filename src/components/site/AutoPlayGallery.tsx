import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import { OptimizedImage } from "./OptimizedImage";

export type GalleryImage = {
  src: string;
  alt: string;
  /** optional caption/label shown as a small pill over the tile */
  caption?: string;
};

type AutoPlayGalleryProps = {
  images: GalleryImage[];
  className?: string;
  /** total scroll cycle duration in seconds */
  durationSeconds?: number;
  /** pause the marquee on hover */
  pauseOnHover?: boolean;
  /** reverse direction */
  reverse?: boolean;
};

/**
 * Calenira-style horizontally auto-playing image ribbon. Uses a pure CSS
 * marquee (`animate-marquee-x`) that respects prefers-reduced-motion.
 */
export function AutoPlayGallery({
  images,
  className,
  durationSeconds = 40,
  pauseOnHover = true,
  reverse = false,
}: AutoPlayGalleryProps) {
  if (images.length === 0) return null;

  // Duplicate the list so the marquee loops seamlessly.
  const loop = [...images, ...images];

  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden",
        "[mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]",
        className,
      )}
    >
      <div
        className={cn(
          "flex w-max items-center gap-6 py-12 will-change-transform [transform:translate3d(0,0,0)] [backface-visibility:hidden]",
          "marquee-x",
          pauseOnHover && "group-hover:[animation-play-state:paused]",
        )}
        style={
          {
            "--marquee-duration": `${durationSeconds}s`,
            "--marquee-direction": reverse ? "reverse" : "normal",
          } as CSSProperties
        }
      >
        {loop.map((img, i) => (
          <figure
            key={`${img.src}-${i}`}
            className={cn(
              "relative shrink-0 overflow-hidden rounded-3xl shadow-soft-warm",
              "transform-gpu",
            )}
            style={{
              width: "clamp(220px, 22vw, 340px)",
              marginTop: i % 2 === 0 ? "0" : "3rem",
              marginBottom: i % 2 === 0 ? "3rem" : "0",
            }}
          >
            <OptimizedImage
              src={img.src}
              alt={img.alt}
              width={720}
              height={900}
              responsiveWidths={[320, 480, 720]}
              sizes="(max-width: 640px) 220px, (max-width: 1280px) 22vw, 340px"
              quality={65}
              loading="lazy"
              className="aspect-[4/5] h-full w-full object-cover"
            />
            {img.caption ? (
              <figcaption className="absolute bottom-3 left-3 inline-flex items-center rounded-full bg-white/85 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-brand-deep backdrop-blur">
                {img.caption}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </div>
  );
}
