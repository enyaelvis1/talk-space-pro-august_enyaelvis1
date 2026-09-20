import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";
import { useRouterState } from "@tanstack/react-router";

export function BackToTopButton() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => setIsVisible(window.scrollY > 420);

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  const hiddenPrefixes = ["/admin", "/account", "/login", "/reset-password"];
  if (hiddenPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return null;
  }

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={`group fixed bottom-20 right-4 z-30 grid h-12 w-12 place-items-center rounded-full border border-white/70 bg-brand-deep text-white shadow-[0_12px_28px_rgba(15,48,77,0.24)] transition-all duration-300 hover:-translate-y-1 hover:bg-accent-terracotta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-terracotta focus-visible:ring-offset-2 sm:bottom-24 sm:right-6 ${
        isVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <ChevronUp
        className="h-6 w-6 stroke-[1.8] transition-transform duration-300 group-hover:-translate-y-0.5"
        aria-hidden
      />
    </button>
  );
}
