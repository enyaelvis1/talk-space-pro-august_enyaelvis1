import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** ms delay before the reveal transition starts */
  delay?: number;
  /** amount of viewport intersection needed to trigger */
  threshold?: number;
  /** element type to render instead of a plain div */
  as?: ElementType;
  [key: `aria-${string}`]: unknown;
};

/**
 * Calenira-style scroll reveal: elements fade + rise into place when they
 * enter the viewport once. Respects prefers-reduced-motion (elements
 * appear immediately without transform).
 */
export function Reveal({
  children,
  className,
  delay = 0,
  threshold = 0.15,
  as,
  ...rest
}: RevealProps) {
  const Component = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setVisible(true);
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            break;
          }
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <Component
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={cn("reveal-on-scroll", visible && "reveal-on-scroll--visible", className)}
      {...rest}
    >
      {children}
    </Component>
  );
}
