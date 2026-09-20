import * as React from "react";
import { cn } from "@/lib/utils";

type Container = "narrow" | "content" | "wide" | "none";
type Spacing = "default" | "lg" | "none";
type Surface = "page" | "card" | "cream" | "none";

const containerClass: Record<Container, string> = {
  narrow: "container-narrow",
  content: "container-content",
  wide: "container-wide",
  none: "",
};

const spacingClass: Record<Spacing, string> = {
  default: "section-y",
  lg: "section-y-lg",
  none: "",
};

const surfaceClass: Record<Surface, string> = {
  page: "bg-background",
  card: "bg-card",
  cream: "bg-surface-cream",
  none: "",
};

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  container?: Container;
  spacing?: Spacing;
  surface?: Surface;
  as?: "section" | "div" | "article" | "aside";
  innerClassName?: string;
}

/**
 * Page section primitive — enforces Calenira-pattern vertical rhythm,
 * container width, and surface tokens. Always prefer this over ad-hoc
 * `<section className="py-20 max-w-6xl mx-auto px-6">` blocks.
 */
export const Section = React.forwardRef<HTMLElement, SectionProps>(
  (
    {
      container = "content",
      spacing = "default",
      surface = "none",
      as: Tag = "section",
      className,
      innerClassName,
      children,
      ...rest
    },
    ref,
  ) => {
    return (
      <Tag
        ref={ref as never}
        className={cn(spacingClass[spacing], surfaceClass[surface], className)}
        {...rest}
      >
        {container === "none" ? (
          children
        ) : (
          <div className={cn(containerClass[container], innerClassName)}>{children}</div>
        )}
      </Tag>
    );
  },
);
Section.displayName = "Section";

export default Section;
