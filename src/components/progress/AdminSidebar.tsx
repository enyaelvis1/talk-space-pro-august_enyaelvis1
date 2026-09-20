import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowLeft,
  CalendarPlus,
  ChevronDown,
  BellRing,
  Files,
  Image,
  LayoutDashboard,
  LogOut,
  Star,
  Mail,
  MessageSquareText,
  Menu,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  CreditCard,
  CalendarCheck,
  Briefcase,
  ClipboardList,
  Settings2,
  Shuffle,
  UsersRound,
  PanelsTopLeft,
  ScrollText,
  ListChecks,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { getVerifiedBrowserSession, hasBrowserRole } from "@/lib/auth";
import { hasProgressAccess } from "@/lib/progress-access";
import { PUBLIC_PAGE_CONFIG } from "@/lib/public-pages";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const primaryNavigation = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/progress", label: "Project progress", icon: Files },
  { to: "/admin/bookings", label: "Upcoming bookings", icon: BellRing },
  { to: "/admin/messages", label: "Messages", icon: MessageSquareText },
  { to: "/admin/emails", label: "Emails", icon: Mail },
  { to: "/admin/payments", label: "Payments", icon: CreditCard },
  { to: "/admin/google", label: "Google Calendar", icon: CalendarCheck },
] as const;

const contentNavigation = [
  { to: "/admin/pages", label: "Pages", icon: Files },
  { to: "/admin/public-pages", label: "Public pages", icon: ScrollText },
  { to: "/admin/hero", label: "Hero section", icon: Image },
  { to: "/admin/homepage", label: "Homepage sections", icon: PanelsTopLeft },
  { to: "/admin/carousel", label: "Homepage carousel", icon: Image },
  { to: "/admin/journal", label: "Journal", icon: Newspaper },
  { to: "/admin/media", label: "Media library", icon: Image },
  { to: "/admin/testimonials", label: "Testimonials", icon: UsersRound },
  { to: "/admin/google-reviews", label: "Google Reviews", icon: Star },
  { to: "/admin/faqs", label: "FAQs", icon: BellRing },
  { to: "/admin/forms", label: "Forms", icon: ClipboardList },
  { to: "/admin/redirects", label: "Redirects", icon: Shuffle },
] as const;

const operationsNavigation = [
  { to: "/admin/services", label: "Services", icon: Briefcase },
  { to: "/admin/therapists", label: "Therapists", icon: UsersRound },
  { to: "/admin/settings", label: "Settings", icon: Settings2 },
  { to: "/admin/migration", label: "Content migration", icon: ListChecks },
  { to: "/admin/audit", label: "Audit log", icon: ScrollText },
] as const;

function isActivePath(pathname: string, target: string) {
  return target === "/admin"
    ? pathname === "/admin" || pathname === "/admin/"
    : pathname.startsWith(target);
}

function adminNavigationLabel(pathname: string) {
  if (isActivePath(pathname, "/admin/clients")) return "Clients";
  if (isActivePath(pathname, "/admin/availability")) return "Availability";
  const allItems = [...primaryNavigation, ...contentNavigation, ...operationsNavigation];
  return allItems.find((item) => isActivePath(pathname, item.to))?.label ?? "Dashboard";
}

function SidebarBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 border-b border-sidebar-border py-5 ${
        collapsed ? "justify-center px-3" : "px-5"
      }`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-mint font-semibold text-brand-deep">
        TS
      </div>
      {!collapsed ? (
        <div>
          <p className="font-semibold tracking-tight text-sidebar-foreground">Talk Space</p>
          <p className="mt-0.5 text-xs text-sidebar-foreground/60">Admin console</p>
        </div>
      ) : null}
    </div>
  );
}

function PrimaryNavigation({
  pathname,
  onNavigate,
  collapsed,
  canViewProgress,
}: {
  pathname: string;
  onNavigate?: () => void;
  collapsed: boolean;
  canViewProgress: boolean;
}) {
  return (
    <div>
      {!collapsed ? (
        <p className="px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/60">
          Overview
        </p>
      ) : null}
      <div className="mt-2 space-y-1">
        {primaryNavigation
          .filter((item) => item.to !== "/admin/progress" || canViewProgress)
          .map((item) => {
            const active = isActivePath(pathname, item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? item.label : undefined}
                title={collapsed ? item.label : undefined}
                onClick={onNavigate}
                className={`relative flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                  collapsed ? "justify-center px-2" : "px-3"
                } ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                    : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className={collapsed ? "sr-only" : undefined}>{item.label}</span>
                {active ? (
                  <span
                    className={`h-1.5 w-1.5 rounded-full bg-brand-mint ${
                      collapsed ? "absolute right-2 top-2" : "ml-auto"
                    }`}
                  />
                ) : null}
              </Link>
            );
          })}
      </div>
    </div>
  );
}

function PublicPagesNavItem({
  active,
  icon: Icon,
  label,
  onNavigate,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onNavigate?: () => void;
}) {
  const currentKey = useRouterState({
    select: (state) => (state.location.search as { page?: string } | undefined)?.page ?? "about",
  });
  const [open, setOpen] = useState(active);
  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <div>
      <div
        className={`relative flex items-center rounded-lg text-sm font-medium transition-colors ${
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
            : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        }`}
      >
        <Link
          to="/admin/public-pages"
          search={{ page: PUBLIC_PAGE_CONFIG[0].key }}
          aria-current={active ? "page" : undefined}

          onClick={onNavigate}
          className="flex flex-1 items-center gap-3 px-3 py-2.5"
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden />
          <span>{label}</span>
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Collapse public pages" : "Expand public pages"}
          onClick={() => setOpen((prev) => !prev)}
          className="px-2 py-2.5 text-sidebar-foreground/70 hover:text-sidebar-foreground"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
      </div>
      {open ? (
        <ul className="mt-1 space-y-0.5 border-l border-sidebar-border/70 pl-3 ml-5">
          {PUBLIC_PAGE_CONFIG.map((page) => {
            const isCurrent = active && currentKey === page.key;
            return (
              <li key={page.key}>
                <Link
                  to="/admin/public-pages"
                  search={{ page: page.key }}
                  onClick={onNavigate}
                  className={`block rounded-md px-3 py-1.5 text-[0.8125rem] transition-colors ${
                    isCurrent
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                  }`}
                >
                  {page.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function LinkGroup({
  label,
  items,
  pathname,
  onNavigate,
  collapsed,
}: {
  label: string;
  items: ReadonlyArray<{ to: string; label: string; icon: LucideIcon }>;
  pathname: string;
  onNavigate?: () => void;
  collapsed: boolean;
}) {
  return (
    <div>
      {!collapsed ? (
        <p className="px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/60">
          {label}
        </p>
      ) : null}
      <div className="mt-2 space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.to);
          if (item.to === "/admin/public-pages" && !collapsed) {
            return (
              <PublicPagesNavItem
                key={item.to}
                active={active}
                icon={Icon}
                label={item.label}
                onNavigate={onNavigate}
              />
            );
          }
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
              onClick={onNavigate}
              className={`relative flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                collapsed ? "justify-center px-2" : "px-3"
              } ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className={collapsed ? "sr-only" : undefined}>{item.label}</span>
              {active ? (
                <span
                  className={`h-1.5 w-1.5 rounded-full bg-brand-mint ${
                    collapsed ? "absolute right-2 top-2" : "ml-auto"
                  }`}
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ClientNavigation({
  pathname,
  onNavigate,
  collapsed,
}: {
  pathname: string;
  onNavigate?: () => void;
  collapsed: boolean;
}) {
  const active = isActivePath(pathname, "/admin/clients");
  return (
    <div>
      {!collapsed ? (
        <p className="px-3 text-[0.6875rem] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/60">
          Operations
        </p>
      ) : null}
      <Link
        to="/admin/clients"
        aria-current={active ? "page" : undefined}
        aria-label={collapsed ? "Clients" : undefined}
        title={collapsed ? "Clients" : undefined}
        onClick={onNavigate}
        className={`relative mt-2 flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors ${
          collapsed ? "justify-center px-2" : "px-3"
        } ${
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
            : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        }`}
      >
        <UsersRound className="h-4 w-4 shrink-0" aria-hidden />
        <span className={collapsed ? "sr-only" : undefined}>Clients</span>
        {active ? (
          <span
            className={`h-1.5 w-1.5 rounded-full bg-brand-mint ${
              collapsed ? "absolute right-2 top-2" : "ml-auto"
            }`}
          />
        ) : null}
      </Link>
    </div>
  );
}

function AvailabilityNavigation({
  pathname,
  onNavigate,
  collapsed,
}: {
  pathname: string;
  onNavigate?: () => void;
  collapsed: boolean;
}) {
  const active = isActivePath(pathname, "/admin/availability");
  return (
    <Link
      to="/admin/availability"
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? "Availability" : undefined}
      title={collapsed ? "Availability" : undefined}
      onClick={onNavigate}
      className={`relative flex items-center gap-3 rounded-lg py-2.5 text-sm font-medium transition-colors ${
        collapsed ? "justify-center px-2" : "px-3"
      } ${
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
          : "text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      }`}
    >
      <CalendarPlus className="h-4 w-4 shrink-0" aria-hidden />
      <span className={collapsed ? "sr-only" : undefined}>Availability</span>
      {active ? (
        <span
          className={`h-1.5 w-1.5 rounded-full bg-brand-mint ${
            collapsed ? "absolute right-2 top-2" : "ml-auto"
          }`}
        />
      ) : null}
    </Link>
  );
}

function SidebarContent({
  pathname,
  onNavigate,
  collapsed = false,
}: {
  pathname: string;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const [canViewProgress, setCanViewProgress] = useState(false);

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    onNavigate?.();
    setCanViewProgress(false);
    await supabase.auth.signOut();
    window.location.assign("/login");
  };

  useEffect(() => {
    let active = true;
    const syncAccessState = async () => {
      const [isAdmin, session] = await Promise.all([
        hasBrowserRole("admin"),
        getVerifiedBrowserSession(),
      ]);
      if (!active) return;
      setCanViewProgress(hasProgressAccess(isAdmin ? "admin" : null, session?.user.email));
    };

    void syncAccessState();

    const onFocusOrVisible = () => {
      if (!document.hidden) void syncAccessState();
    };
    const intervalId = window.setInterval(() => {
      void syncAccessState();
    }, 30000);
    window.addEventListener("focus", onFocusOrVisible);
    document.addEventListener("visibilitychange", onFocusOrVisible);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocusOrVisible);
      document.removeEventListener("visibilitychange", onFocusOrVisible);
    };
  }, []);

  return (
    <div className="flex min-h-full flex-col bg-sidebar text-sidebar-foreground">
      <SidebarBrand collapsed={collapsed} />
      <nav
        aria-label="Admin navigation"
        className={`flex-1 space-y-7 overflow-y-auto py-6 ${collapsed ? "px-2" : "px-3"}`}
      >
        <PrimaryNavigation
          pathname={pathname}
          onNavigate={onNavigate}
          collapsed={collapsed}
          canViewProgress={canViewProgress}
        />
        <LinkGroup
          label="Content management"
          items={contentNavigation}
          pathname={pathname}
          onNavigate={onNavigate}
          collapsed={collapsed}
        />
        <ClientNavigation pathname={pathname} onNavigate={onNavigate} collapsed={collapsed} />
        <AvailabilityNavigation pathname={pathname} onNavigate={onNavigate} collapsed={collapsed} />
        <LinkGroup
          label="More operations"
          items={operationsNavigation}
          pathname={pathname}
          onNavigate={onNavigate}
          collapsed={collapsed}
        />
      </nav>
      <div className={`space-y-1 border-t border-sidebar-border ${collapsed ? "p-2" : "p-3"}`}>
        <Link
          to="/"
          onClick={onNavigate}
          aria-label={collapsed ? "Back to website" : undefined}
          title={collapsed ? "Back to website" : undefined}
          className={`flex items-center gap-3 rounded-lg py-2.5 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground ${
            collapsed ? "justify-center px-2" : "px-3"
          }`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          <span className={collapsed ? "sr-only" : undefined}>Back to website</span>
        </Link>
        <Link
          to="/account"
          onClick={onNavigate}
          aria-label={collapsed ? "Admin account" : undefined}
          title={collapsed ? "Admin account" : undefined}
          className={`flex items-center gap-3 rounded-lg py-2.5 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground ${
            collapsed ? "justify-center px-2" : "px-3"
          }`}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
            A
          </div>
          <span className={collapsed ? "sr-only" : "min-w-0 flex-1 truncate"}>Admin account</span>
          {!collapsed ? <Settings2 className="h-4 w-4" aria-hidden /> : null}
        </Link>
        <button
          type="button"
          onClick={() => void signOut()}
          aria-label={collapsed ? "Log out" : undefined}
          title={collapsed ? "Log out" : undefined}
          className={`flex w-full items-center gap-3 rounded-lg py-2.5 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground ${
            collapsed ? "justify-center px-2" : "px-3"
          }`}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          <span className={collapsed ? "sr-only" : undefined}>Log out</span>
        </button>
      </div>
    </div>
  );
}

function AdminLoadingOverlay() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isLoading = useRouterState({ select: (state) => state.isLoading || state.isTransitioning });

  if (!isLoading) return null;

  const isDetailPage = pathname.startsWith("/admin/clients/");
  const isGridPage =
    pathname.startsWith("/admin/media") ||
    pathname.startsWith("/admin/carousel") ||
    pathname.startsWith("/admin/testimonials") ||
    pathname.startsWith("/admin/google-reviews") ||
    pathname.startsWith("/admin/hero") ||
    pathname.startsWith("/admin/homepage");
  const isTablePage =
    pathname.startsWith("/admin/pages") ||
    pathname.startsWith("/admin/journal") ||
    pathname.startsWith("/admin/services") ||
    pathname.startsWith("/admin/google") ||
    pathname.startsWith("/admin/faqs") ||
    pathname.startsWith("/admin/redirects") ||
    pathname.startsWith("/admin/bookings") ||
    pathname.startsWith("/admin/emails") ||
    pathname.startsWith("/admin/payments") ||
    pathname.startsWith("/admin/migration") ||
    pathname.startsWith("/admin/audit");
  const isAvailabilityPage = pathname.startsWith("/admin/availability");

  return (
    <div
      aria-live="polite"
      aria-busy="true"
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden bg-surface-page/95 px-4 py-8 backdrop-blur-[2px] sm:px-6 sm:py-10"
    >
      <div className="mx-auto flex h-full w-full max-w-7xl flex-col gap-8">
        <div className="space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-80 max-w-full" />
          <Skeleton className="h-5 w-[32rem] max-w-full" />
        </div>

        {isDetailPage ? (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <Skeleton className="h-64 rounded-2xl" />
              <Skeleton className="h-72 rounded-2xl" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-56 rounded-2xl" />
              <Skeleton className="h-80 rounded-2xl" />
            </div>
          </div>
        ) : isGridPage ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div
                key={index}
                className="space-y-3 rounded-2xl border border-border/70 bg-card p-4"
              >
                <Skeleton className="aspect-[4/3] w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : isAvailabilityPage ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <Skeleton className="h-[31rem] rounded-xl" />
            <Skeleton className="h-[31rem] rounded-xl" />
          </div>
        ) : isTablePage ? (
          <div className="space-y-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-72 rounded-xl" />
          </div>
        ) : (
          <>
            <Skeleton className="h-64 rounded-2xl" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-36 rounded-xl" />
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-96 rounded-xl" />
              <Skeleton className="h-96 rounded-xl" />
            </div>
            <Skeleton className="h-56 rounded-xl" />
          </>
        )}
      </div>
    </div>
  );
}

export function AdminSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarReady, setSidebarReady] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const stored = window.localStorage.getItem("talk-space.admin-sidebar-collapsed");
    setCollapsed(stored === "true");
    setSidebarReady(true);
  }, []);

  useEffect(() => {
    if (sidebarReady) {
      window.localStorage.setItem("talk-space.admin-sidebar-collapsed", String(collapsed));
    }
  }, [collapsed, sidebarReady]);

  return (
    <>
      <aside
        className={`relative sticky top-0 hidden h-screen shrink-0 transition-[width] duration-200 lg:flex lg:flex-col print:hidden ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <SidebarContent pathname={pathname} collapsed={collapsed} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={collapsed ? "Expand admin sidebar" : "Collapse admin sidebar"}
          aria-expanded={!collapsed}
          title={collapsed ? "Expand admin sidebar" : "Collapse admin sidebar"}
          onClick={() => setCollapsed((current) => !current)}
          className="absolute -right-3 top-6 z-10 h-7 w-7 rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-md hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <PanelLeftClose className="h-3.5 w-3.5" aria-hidden />
          )}
        </Button>
      </aside>

      <div className="border-b border-border/70 bg-white/90 px-4 py-3 backdrop-blur-md lg:hidden print:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-deep/60">
              Admin console
            </p>
            <p className="mt-1 text-sm font-medium text-brand-deep">
              {adminNavigationLabel(pathname)}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Open admin navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground sm:max-w-xs"
        >
          <SheetTitle className="sr-only">Admin navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Navigate between Talk Space admin workspace sections.
          </SheetDescription>
          <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

export function AdminWorkspaceShell({ children }: { children: ReactNode }) {
  return (
    <div className="admin-theme flex min-h-screen flex-1 flex-col lg:flex-row">
      <AdminSidebar />
      <div className="relative min-w-0 flex-1">
        <AdminLoadingOverlay />
        {children}
      </div>
    </div>
  );
}
