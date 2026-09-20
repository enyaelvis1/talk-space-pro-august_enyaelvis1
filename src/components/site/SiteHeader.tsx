import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { Link, useMatch, useRouterState } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { Menu, X } from "lucide-react";

import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { BrandWordmark } from "@/components/site/BrandWordmark";

const WHATSAPP_NUMBER = "2347048469090";
const WHATSAPP_MESSAGE = "Hi Talk Space, I'd like to ask about booking a session.";
const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { getSessionExpiryState, getVerifiedBrowserSession, hasBrowserRole } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { DEFAULT_SITE_DETAILS } from "@/lib/content.functions";

const NAV = [
  { to: "/services", label: "Services" },
  { to: "/therapists", label: "Therapists" },
  { to: "/pricing", label: "Pricing" },
  { to: "/about", label: "About" },
  { to: "/blog", label: "Journal" },
  { to: "/contact", label: "Contact" },
] as const;

const MOBILE_NAV = [{ to: "/", label: "Home" }, ...NAV] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionExpiryWarning, setSessionExpiryWarning] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTherapist, setIsTherapist] = useState(false);
  const details =
    useMatch({
      from: "__root__",
      shouldThrow: false,
      select: (match) => match.loaderData,
    }) ?? DEFAULT_SITE_DETAILS;
  const { logoPath, brandName } = details;
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileDialogRef = useRef<HTMLDivElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const accountHref = isTherapist ? "/therapist" : "/account";
  const accountLabel = isTherapist ? "Dashboard" : "Account";

  // Keep the header in sync with sign-in, sign-out, token refresh, and expired sessions.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setSessionLoading(false);
      return;
    }

    let mounted = true;
    const syncAuthState = async () => {
      const verifiedSession = await getVerifiedBrowserSession();
      if (!mounted) return;

      if (!verifiedSession) {
        setSession(null);
        setIsAdmin(false);
        setIsTherapist(false);
        setSessionExpiryWarning(null);
        setSessionLoading(false);
        return;
      }

      const expiryState = getSessionExpiryState(verifiedSession);
      if (expiryState.isWarning && expiryState.expiresInMs !== null) {
        const remainingMinutes = Math.max(1, Math.ceil(expiryState.expiresInMs / 60000));
        setSessionExpiryWarning(`Session expires in ${remainingMinutes} min`);
      } else {
        setSessionExpiryWarning(null);
      }

      const [adminRole, therapistRole] = await Promise.all([
        hasBrowserRole("admin"),
        hasBrowserRole("therapist"),
      ]);

      if (!mounted) return;
      setSession(verifiedSession);
      setIsAdmin(adminRole);
      setIsTherapist(therapistRole);
      setSessionLoading(false);
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) {
        if (mounted) {
          setSession(null);
          setIsAdmin(false);
          setIsTherapist(false);
          setSessionLoading(false);
        }
        return;
      }
      void syncAuthState();
    });

    void syncAuthState();

    const onFocusOrVisible = () => {
      if (!document.hidden) void syncAuthState();
    };
    const intervalId = window.setInterval(() => {
      onFocusOrVisible();
    }, 30000);
    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
    };
  }, []);

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setSession(null);
    setIsAdmin(false);
    setIsTherapist(false);
    setSessionExpiryWarning(null);
    setSessionLoading(false);
    setOpen(false);
    await supabase.auth.signOut();
  }

  // Close the mobile sheet on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dialog = mobileDialogRef.current;
    if (!dialog) return;
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
    const first = focusable.at(0);
    const last = focusable.at(-1);
    const frame = window.requestAnimationFrame(() => first?.focus());

    const containFocus = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        window.requestAnimationFrame(() => menuButtonRef.current?.focus());
        return;
      }
      if (event.key !== "Tab" || !first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", containFocus);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", containFocus);
    };
  }, [open]);

  function focusMainContent(event: MouseEvent<HTMLAnchorElement>) {
    const main = document.getElementById("main");
    if (!main) return;
    event.preventDefault();
    main.setAttribute("tabindex", "-1");
    main.focus();
    main.scrollIntoView({ block: "start" });
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}#main`,
    );
  }

  // Keep the floating pill header visually elevated after the user scrolls.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <a
        href="#main"
        onClick={focusMainContent}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-brand-deep focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-50">
        <div
          className={cn(
            "mx-2 mt-2 grid h-14 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-full bg-surface-card px-2 shadow-soft-warm transition-all duration-300 sm:mx-6 sm:mt-3 sm:h-16 sm:gap-3 sm:px-3 lg:mx-auto lg:h-20 lg:grid-cols-[auto_1fr_auto] lg:gap-6 lg:bg-surface-cream/70 lg:backdrop-blur",
            scrolled && "lg:bg-surface-card/95 lg:shadow-lg",
          )}
        >
          <Link
            to="/"
            className="flex min-w-0 items-center text-brand-deep transition-colors hover:text-brand-blue-deep sm:gap-3"
            aria-label={`${brandName}, home`}
          >
            <BrandWordmark
              brandName={brandName}
              logoPath={logoPath}
              className="max-w-36 sm:max-w-none"
            />
          </Link>

          <nav aria-label="Primary" className="hidden justify-self-center lg:block">
            <ul className="flex items-center gap-1 rounded-full border border-accent-terracotta/15 bg-surface-cream/70 px-2 py-1.5 shadow-soft-warm backdrop-blur">
              {NAV.map((item) => {
                const active = pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-accent-terracotta text-white shadow-soft-warm"
                          : "text-brand-deep/70 hover:bg-accent-terracotta-soft hover:text-accent-terracotta",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              {isAdmin ? (
                <li>
                  <Link
                    to="/admin"
                    className="relative rounded-full px-4 py-1.5 text-sm font-medium text-brand-deep/70 transition-colors hover:bg-accent-terracotta-soft hover:text-accent-terracotta"
                  >
                    Admin
                  </Link>
                </li>
              ) : null}
              {isTherapist ? (
                <li>
                  <Link
                    to="/therapist"
                    className="relative rounded-full px-4 py-1.5 text-sm font-medium text-brand-deep/70 transition-colors hover:bg-accent-terracotta-soft hover:text-accent-terracotta"
                  >
                    Therapist
                  </Link>
                </li>
              ) : null}
            </ul>
          </nav>

          <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
            {sessionExpiryWarning ? (
              <span className="hidden rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 lg:inline-flex">
                {sessionExpiryWarning}
              </span>
            ) : null}
            <a
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Chat with Talk Space on WhatsApp"
              className="hidden h-10 w-10 items-center justify-center rounded-full text-brand-deep transition-colors hover:bg-surface-cream hover:text-accent-terracotta lg:inline-flex"
            >
              <WhatsAppIcon className="h-5 w-5" aria-hidden />
              <span className="sr-only">Chat on WhatsApp</span>
            </a>
            {sessionLoading ? (
              <Skeleton className="hidden h-10 w-24 rounded-full lg:block" />
            ) : session ? (
              <>
                <Button asChild variant="pillOutline" size="pill" className="hidden lg:inline-flex">
                  <Link to={accountHref}>{accountLabel}</Link>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSignOut}
                  className="hidden rounded-full text-brand-deep hover:bg-surface-cream hover:text-accent-terracotta lg:inline-flex"
                >
                  Sign out
                </Button>
              </>
            ) : (
              <Button asChild variant="pillOutline" size="pill" className="hidden lg:inline-flex">
                <Link to="/login">Login</Link>
              </Button>
            )}
            <Button
              asChild
              variant="terracotta"
              size="pill"
              className="shadow-soft-warm max-[359px]:hidden"
            >
              <Link to="/book">
                <span className="hidden sm:inline">Book a call</span>
                <span className="sm:hidden">Book</span>
              </Link>
            </Button>
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent-terracotta text-white shadow-soft-warm transition-colors hover:bg-accent-terracotta/90 lg:hidden"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sheet */}
      <div
        id="mobile-nav"
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!open}
        inert={!open}
      >
        <div
          className={cn(
            "absolute inset-0 bg-brand-deep/30 backdrop-blur-sm transition-opacity duration-200",
            open ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setOpen(false)}
        />
        <div
          ref={mobileDialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          className={cn(
            "absolute bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-0 top-[76px] flex w-[86%] max-w-sm flex-col overflow-hidden rounded-b-[2.5rem] bg-surface-cream shadow-2xl transition-transform duration-300 ease-out",
            open ? "translate-x-0" : "translate-x-full",
          )}
        >
          <nav aria-label="Mobile" className="flex flex-1 flex-col overflow-y-auto px-6 pb-3 pt-3">
            <ul className="flex flex-1 flex-col justify-between">
              {MOBILE_NAV.map((item) => {
                const active =
                  pathname === item.to || (item.to !== "/" && pathname.startsWith(item.to + "/"));
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "block py-3 text-lg font-medium text-brand-deep transition-colors hover:text-accent-terracotta",
                        active && "text-accent-terracotta",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
              {isAdmin ? (
                <li>
                  <Link
                    to="/admin"
                    className="block py-3 text-lg font-medium text-brand-deep transition-colors hover:text-accent-terracotta"
                  >
                    Admin
                  </Link>
                </li>
              ) : null}
              {isTherapist ? (
                <li>
                  <Link
                    to="/therapist"
                    className="block py-3 text-lg font-medium text-brand-deep transition-colors hover:text-accent-terracotta"
                  >
                    Therapist
                  </Link>
                </li>
              ) : null}
            </ul>
            <div className="mt-2 flex flex-col gap-3">
              <Button
                asChild
                variant="terracotta"
                size="pill"
                className="h-12 w-full text-base shadow-soft-warm"
              >
                <Link to="/book">Book Session</Link>
              </Button>
              {sessionLoading ? (
                <Skeleton className="h-12 w-full rounded-full" />
              ) : session ? (
                <>
                  <Button
                    asChild
                    variant="pillOutline"
                    size="pill"
                    className="h-12 w-full text-base"
                  >
                    <Link to={accountHref}>{accountLabel}</Link>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleSignOut}
                    className="text-brand-deep hover:bg-brand-blue-soft"
                  >
                    Sign out
                  </Button>
                </>
              ) : (
                <Button asChild variant="pillOutline" size="pill" className="h-12 w-full text-base">
                  <Link to="/login">Login</Link>
                </Button>
              )}
            </div>
          </nav>
        </div>
      </div>
    </>
  );
}
