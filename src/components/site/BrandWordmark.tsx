import brandLogo from "@/assets/talk-space-logo.png";
import { OptimizedImage } from "@/components/site/OptimizedImage";
import { cn } from "@/lib/utils";

type BrandWordmarkProps = {
  brandName: string;
  logoPath?: string | null;
  className?: string;
  size?: "header" | "footer";
};

function hasCustomLogo(logoPath?: string | null) {
  return Boolean(logoPath && logoPath !== "/favicon-512x512.png");
}

export function BrandWordmark({ logoPath, className, size = "header" }: BrandWordmarkProps) {
  const src = hasCustomLogo(logoPath) ? (logoPath as string) : brandLogo;

  return (
    <OptimizedImage
      src={src}
      alt=""
      aria-hidden
      width={940}
      height={232}
      responsiveWidths={[192, 384, 768]}
      sizes="(max-width: 640px) 190px, 280px"
      quality={72}
      loading={size === "header" ? "eager" : "lazy"}
      className={cn(
        "h-10 w-auto max-w-full object-contain object-left sm:h-11 lg:h-13",
        size === "footer" && "h-11 sm:h-12 lg:h-14",
        className,
      )}
    />
  );
}
