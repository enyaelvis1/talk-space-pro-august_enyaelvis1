import { Outlet, createFileRoute } from "@tanstack/react-router";

import { requireBrowserSession } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    await requireBrowserSession(location.href);
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return <Outlet />;
}
