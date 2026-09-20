import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import * as Sentry from "@sentry/tanstackstart-react";
import { type CSSProperties, type ReactNode, useEffect } from "react";

import { Toaster } from "@/components/ui/sonner";
import { FloatingActionDock } from "@/components/site/FloatingActionDock";
import { BackToTopButton } from "@/components/site/BackToTopButton";
import { SiteAppearance } from "@/components/site/SiteAppearance";
import { PublicRouteSkeleton } from "@/components/site/PublicRouteSkeleton";
import { DEFAULT_SITE_DETAILS, getPublicSiteDetails } from "@/lib/content.functions";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import appCss from "../styles.css?url";
import { OG_IMAGE_URL, SITE_URL } from "../lib/seo";

export { OG_IMAGE_URL, SITE_URL } from "../lib/seo";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isPublic = !pathname.startsWith("/admin");

  useEffect(() => {
    Sentry.captureException(error, {
      tags: { surface: "tanstack_router_error_boundary", path: pathname },
    });
    reportLovableError(error, { surface: "tanstack_router_error_boundary" });
  }, [error, pathname]);

  useEffect(() => {
    if (!isPublic) return;

    const retryId = window.setTimeout(() => {
      void router.invalidate().then(reset);
    }, 1_500);

    return () => window.clearTimeout(retryId);
  }, [isPublic, reset, router]);

  if (isPublic) {
    return (
      <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
        <PublicRouteSkeleton pathname={pathname} />
      </main>
    );
  }

  const detail =
    error instanceof Response
      ? `Response ${error.status}${error.url ? ` at ${error.url}` : ""}`
      : (error?.message ?? String(error));

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">The app reported this error:</p>
        <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md border border-destructive/30 bg-destructive/5 p-3 text-left text-xs text-destructive">
          {detail}
        </pre>
        {error?.stack ? (
          <details className="mt-3 text-left">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Technical details
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-foreground/90 p-3 text-xs text-background">
              {error.stack}
            </pre>
          </details>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

function PublicLoadingIndicator() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const isLoading = useRouterState({ select: (state) => state.isLoading || state.isTransitioning });

  if (!isLoading) return null;
  if (pathname.startsWith("/admin")) return null;

  return (
    <div
      aria-live="polite"
      aria-busy="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 pt-2 sm:px-6"
    >
      <div className="mx-auto h-1 w-full max-w-7xl overflow-hidden rounded-full bg-background/30">
        <div className="h-full w-1/3 rounded-full bg-brand-blue/70 shadow-[0_0_18px_rgba(47,107,166,0.45)] animate-pulse" />
      </div>
      <span className="sr-only">Loading page</span>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: () => getPublicSiteDetails(),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#2F312C" },
      {
        title: "Talk Space Counselling Services | Licensed Nigerian therapists, online & in-person",
      },
      {
        name: "description",
        content:
          "Talk Space helps individuals, couples and families access professional counselling in Nigeria through a clear, confidential booking experience, online or in person.",
      },
      { name: "author", content: "Talk Space Counselling Services" },
      {
        property: "og:title",
        content: "Talk Space Counselling Services",
      },
      {
        property: "og:description",
        content:
          "Professional counselling for individuals, couples and families. Confidential. Professional. Accessible.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: OG_IMAGE_URL },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Talk Space Counselling Services" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:title",
        content:
          "Talk Space Counselling Services | Licensed Nigerian therapists, online & in-person",
      },
      {
        name: "twitter:title",
        content:
          "Talk Space Counselling Services | Licensed Nigerian therapists, online & in-person",
      },
      {
        name: "description",
        content:
          "Talk Space Counselling Services offers structured, ethical therapy for anxiety, marriage, trauma, teens and families | for Nigerians at home and in the diaspora.",
      },
      {
        property: "og:description",
        content:
          "Talk Space Counselling Services offers structured, ethical therapy for anxiety, marriage, trauma, teens and families | for Nigerians at home and in the diaspora.",
      },
      {
        name: "twitter:description",
        content:
          "Talk Space Counselling Services offers structured, ethical therapy for anxiety, marriage, trauma, teens and families | for Nigerians at home and in the diaspora.",
      },
      { name: "twitter:image", content: OG_IMAGE_URL },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "icon", href: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { rel: "icon", href: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  // shellComponent wraps the route error boundary, so it must remain safe
  // even while root loader data is unavailable during a rebuild or retry.
  const details = Route.useLoaderData() ?? DEFAULT_SITE_DETAILS;
  const appearance = details?.appearance;
  const rootStyle = appearance
    ? ({
        "--site-background": appearance.backgroundColor,
        "--site-text": appearance.textColor,
        "--site-accent": appearance.accentColor,
        "--site-body-font":
          appearance.bodyFont === "serif"
            ? "Georgia, serif"
            : '"Inter", ui-sans-serif, system-ui, sans-serif',
        "--site-heading-font":
          appearance.headingFont === "sans"
            ? '"Inter", ui-sans-serif, system-ui, sans-serif'
            : '"Fraunces", Georgia, serif',
        "--site-base-size":
          appearance.baseFontSize === "lg"
            ? "18px"
            : appearance.baseFontSize === "sm"
              ? "15px"
              : "16px",
        "--site-section-spacing":
          appearance.sectionSpacing === "spacious"
            ? "1.2"
            : appearance.sectionSpacing === "compact"
              ? "0.85"
              : "1",
      } as CSSProperties)
    : undefined;
  return (
    <html lang="en" style={rootStyle} data-button-style={appearance?.buttonStyle}>
      <head>
        <HeadContent />
      </head>
      <body
        style={
          appearance
            ? { backgroundColor: appearance.backgroundColor, color: appearance.textColor }
            : undefined
        }
      >
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const details = Route.useLoaderData();

  return (
    <QueryClientProvider client={queryClient}>
      <SiteAppearance details={details} />
      <PublicLoadingIndicator />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <FloatingActionDock />
      <BackToTopButton />
      <Toaster />
    </QueryClientProvider>
  );
}
