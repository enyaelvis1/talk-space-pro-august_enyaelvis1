import { Outlet, createFileRoute } from "@tanstack/react-router";

import { requireBrowserAdmin } from "@/lib/auth";
import { canonicalUrl } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async ({ location }) => {
    await requireBrowserAdmin(location.href);
  },
  head: () => ({
    meta: [{ title: "Admin | Talk Space" }, { name: "robots", content: "noindex, nofollow" }],
    links: [{ rel: "canonical", href: canonicalUrl("/admin") }],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  return <Outlet />;
}
