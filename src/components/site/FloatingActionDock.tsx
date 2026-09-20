import { useRouterState } from "@tanstack/react-router";
import { CalendarDays, Home, Mail } from "lucide-react";

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { WHATSAPP_HREF } from "@/lib/talkspace";

/**
 * Calenira-inspired floating action dock: Book / Contact / WhatsApp.
 * Hidden on admin, auth and account routes. Public routes only.
 */
export function FloatingActionDock() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const HIDDEN_PREFIXES = ["/admin", "/account", "/login", "/reset-password", "/book"];
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return null;
  }

  const mobileItemClass =
    "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[0.65rem] font-medium text-brand-deep/80 transition-colors hover:text-accent-terracotta active:text-accent-terracotta";
  const desktopItemClass =
    "grid h-11 w-11 place-items-center rounded-full bg-white text-brand-deep transition-colors hover:bg-accent-terracotta-soft hover:text-accent-terracotta";

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Mobile: full-width bottom nav bar with labels (Calenira style) */}
      <nav
        aria-label="Quick actions"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgba(0,0,0,0.15)] backdrop-blur print:hidden sm:hidden"
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around">
          <a
            href="/"
            className={mobileItemClass}
            aria-label="Home"
            aria-current={isActive("/") ? "page" : undefined}
          >
            <Home
              className={`h-5 w-5 ${isActive("/") ? "text-accent-terracotta" : ""}`}
              aria-hidden
            />
            <span className={isActive("/") ? "text-accent-terracotta" : ""}>Home</span>
          </a>
          <a
            href="/book"
            className={mobileItemClass}
            aria-label="Book an appointment"
            aria-current={isActive("/book") ? "page" : undefined}
          >
            <CalendarDays
              className={`h-5 w-5 ${isActive("/book") ? "text-accent-terracotta" : ""}`}
              aria-hidden
            />
            <span className={isActive("/book") ? "text-accent-terracotta" : ""}>Appointment</span>
          </a>
          <a
            href="/contact"
            className={mobileItemClass}
            aria-label="Email Talk Space"
            aria-current={isActive("/contact") ? "page" : undefined}
          >
            <Mail
              className={`h-5 w-5 ${isActive("/contact") ? "text-accent-terracotta" : ""}`}
              aria-hidden
            />
            <span className={isActive("/contact") ? "text-accent-terracotta" : ""}>Email</span>
          </a>
          <a
            href={WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className={mobileItemClass}
            aria-label="Chat on WhatsApp"
          >
            <WhatsAppIcon className="h-5 w-5" aria-hidden />
            <span>WhatsApp</span>
          </a>
        </div>
      </nav>

      {/* Desktop/tablet: floating pill dock */}
      <div
        aria-label="Quick actions"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-40 hidden justify-center px-4 print:hidden sm:flex"
      >
        <div className="motion-dock-shake pointer-events-auto flex items-center gap-2 rounded-full border border-accent-terracotta/20 bg-accent-terracotta-soft/90 px-3 py-2 shadow-soft-warm backdrop-blur">
          <a href="/book" className={desktopItemClass} aria-label="Book a session">
            <CalendarDays className="h-5 w-5" aria-hidden />
          </a>
          <a href="/contact" className={desktopItemClass} aria-label="Contact Talk Space">
            <Mail className="h-5 w-5" aria-hidden />
          </a>
          <a
            href={WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            className={desktopItemClass}
            aria-label="Chat on WhatsApp"
          >
            <WhatsAppIcon className="h-5 w-5" aria-hidden />
          </a>
        </div>
      </div>
    </>
  );
}
