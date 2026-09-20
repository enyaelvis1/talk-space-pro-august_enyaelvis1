import type { ImgHTMLAttributes } from "react";

type Props = ImgHTMLAttributes<HTMLImageElement> & {
  avifSrc?: string;
  width: number;
  height: number;
  responsiveWidths?: number[];
  mobileResponsiveWidths?: number[];
  quality?: number;
};

const DEFAULT_RESPONSIVE_WIDTHS = [480, 768, 1280];

function transformedSupabaseImage(source: string, width: number, height: number, quality: number) {
  const publicImage = source.includes("/storage/v1/object/public/");
  const signedImage = source.includes("/storage/v1/object/sign/");
  if (!publicImage && !signedImage) return null;
  const url = new URL(source);
  url.pathname = publicImage
    ? url.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/")
    : url.pathname.replace("/storage/v1/object/sign/", "/storage/v1/render/image/sign/");
  url.searchParams.set("width", String(width));
  url.searchParams.set("height", String(height));
  url.searchParams.set("resize", "cover");
  url.searchParams.set("quality", String(quality));
  return url.href;
}

export function OptimizedImage({
  avifSrc,
  decoding = "async",
  loading = "lazy",
  mobileResponsiveWidths,
  responsiveWidths,
  quality = 72,
  src,
  width,
  height,
  ...props
}: Props) {
  const widths = responsiveWidths ?? DEFAULT_RESPONSIVE_WIDTHS;
  const transformed =
    typeof src === "string"
      ? widths.flatMap((candidateWidth) => {
          const candidateHeight = Math.max(1, Math.round((height / width) * candidateWidth));
          const candidate = transformedSupabaseImage(src, candidateWidth, candidateHeight, quality);
          return candidate ? [`${candidate} ${candidateWidth}w`] : [];
        })
      : [];
  const mobileTransformed =
    typeof src === "string" && mobileResponsiveWidths?.length
      ? mobileResponsiveWidths.flatMap((candidateWidth) => {
          const candidateHeight = Math.max(1, Math.round((height / width) * candidateWidth));
          const candidate = transformedSupabaseImage(src, candidateWidth, candidateHeight, quality);
          return candidate ? [`${candidate} ${candidateWidth}w`] : [];
        })
      : [];
  const fallback =
    typeof src === "string"
      ? (transformedSupabaseImage(
          src,
          Math.min(width, widths.at(-1) ?? width),
          Math.min(height, Math.round((height / width) * (widths.at(-1) ?? width))),
          quality,
        ) ?? src)
      : src;

  return (
    <picture>
      {avifSrc ? <source srcSet={avifSrc} type="image/avif" /> : null}
      {mobileTransformed.length ? (
        <source media="(max-width: 640px)" srcSet={mobileTransformed.join(", ")} />
      ) : null}
      <img
        decoding={decoding}
        loading={loading}
        src={fallback}
        srcSet={transformed.length ? transformed.join(", ") : undefined}
        width={width}
        height={height}
        {...props}
      />
    </picture>
  );
}
