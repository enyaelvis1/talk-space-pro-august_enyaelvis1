import { Link, useRouterState } from "@tanstack/react-router";
import { Fragment } from "react";
import { ChevronRight, Home } from "lucide-react";

const LABELS: Record<string, string> = {
  about: "About",
  blog: "Journal",
  book: "Book a session",
  "cancellation-refund-policy": "Cancellation & refunds",
  contact: "Contact",
  "emergency-support": "Emergency support",
  faqs: "FAQs",
  pricing: "Pricing",
  "privacy-policy": "Privacy policy",
  services: "Services",
  terms: "Terms",
  therapists: "Therapists",
};

export interface Crumb {
  label: string;
  to?: string;
}

interface Props {
  /** Override the last crumb (e.g. blog post title). */
  currentLabel?: string;
  /** Fully custom trail; overrides auto-derivation. */
  items?: Crumb[];
  className?: string;
}

function humanize(seg: string) {
  return LABELS[seg] ?? seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SiteBreadcrumbs({ currentLabel, items, className }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const trail: Crumb[] =
    items ??
    (() => {
      const segments = pathname.split("/").filter(Boolean);
      if (segments.length === 0) return [];
      const crumbs: Crumb[] = [];
      let acc = "";
      segments.forEach((seg, i) => {
        acc += `/${seg}`;
        const isLast = i === segments.length - 1;
        crumbs.push({
          label: isLast && currentLabel ? currentLabel : humanize(seg),
          to: isLast ? undefined : acc,
        });
      });
      return crumbs;
    })();

  if (trail.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={"border-b border-border/60 bg-surface-page/80 " + (className ?? "")}
    >
      <ol className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-1.5 px-4 py-3 text-sm text-muted-foreground sm:px-6 lg:px-8">
        <li className="inline-flex items-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1 transition-colors hover:text-brand-blue-deep"
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">Home</span>
          </Link>
        </li>
        {trail.map((crumb, i) => (
          <Fragment key={`${crumb.label}-${i}`}>
            <li aria-hidden="true" className="inline-flex items-center">
              <ChevronRight className="h-3.5 w-3.5" />
            </li>
            <li className="inline-flex items-center">
              {crumb.to ? (
                <Link
                  to={crumb.to as never}
                  className="transition-colors hover:text-brand-blue-deep"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span aria-current="page" className="font-medium text-brand-deep">
                  {crumb.label}
                </span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
