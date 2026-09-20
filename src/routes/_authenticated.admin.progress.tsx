import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";

import {
  ProgressDashboard,
  ProgressDashboardSkeleton,
} from "@/components/progress/ProgressDashboard";
import {
  getVerifiedBrowserSession,
  hasBrowserRole,
  requireBrowserProgressAccess,
} from "@/lib/auth";
import { hasProgressAccess } from "@/lib/progress-access";
import { getRestrictedProgressSnapshot } from "@/lib/progress.functions";
import { canonicalUrl } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/progress")({
  beforeLoad: async ({ location }) => {
    await requireBrowserProgressAccess(location.href);
  },
  loader: async () => {
    const snapshot = await getRestrictedProgressSnapshot();
    if (!snapshot) throw redirect({ href: "/account?error=forbidden" });
    return snapshot;
  },
  head: () => ({
    meta: [
      { title: "Project progress | Talk Space" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/progress") }],
  }),
  component: ProgressRoute,
});

function ProgressRoute() {
  const snapshot = Route.useLoaderData();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([hasBrowserRole("admin"), getVerifiedBrowserSession()]).then(
      ([isAdmin, session]) => {
        if (active) setAuthorized(hasProgressAccess(isAdmin ? "admin" : null, session?.user.email));
      },
    );
    return () => {
      active = false;
    };
  }, []);

  if (authorized === null) return <ProgressDashboardSkeleton />;
  if (!authorized) {
    return (
      <main id="main" className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="display-1 text-brand-deep">Permission required</h1>
        <p className="mt-4 text-muted-foreground">
          You do not have permission to view the project progress dashboard.
        </p>
      </main>
    );
  }

  return <ProgressDashboard snapshot={snapshot} />;
}
