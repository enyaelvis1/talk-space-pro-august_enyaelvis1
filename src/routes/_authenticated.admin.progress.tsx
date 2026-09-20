import { createFileRoute, redirect } from "@tanstack/react-router";

import { ProgressDashboard } from "@/components/progress/ProgressDashboard";
import { requireBrowserProgressAccess } from "@/lib/auth";
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
  return <ProgressDashboard snapshot={snapshot} />;
}
