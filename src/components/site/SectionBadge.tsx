import { cn } from "@/lib/utils";

type SectionBadgeProps = {
  children: React.ReactNode;
  className?: string;
  tone?: "terracotta" | "mint" | "blue";
};

/**
 * Calenira-style pill "eyebrow" badge above section headings.
 * Keeps Talk Space brand tokens; defaults to terracotta accent.
 */
export function SectionBadge({ children, className, tone = "terracotta" }: SectionBadgeProps) {
  const tones = {
    terracotta: "bg-accent-terracotta-soft text-accent-terracotta",
    mint: "bg-brand-mint-soft text-brand-deep",
    blue: "bg-brand-blue-soft text-brand-deep",
  } as const;
  return (
    <span
      className={cn(
        "flex w-fit items-center justify-center rounded-full px-3.5 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em]",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
