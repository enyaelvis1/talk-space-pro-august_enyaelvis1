import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { AdminClientDetail, AdminClientDetailSkeleton } from "@/components/admin/AdminClientDetail";
import { hasBrowserRole, requireBrowserAdmin } from "@/lib/auth";
import {
  getAdminClientDetail,
  type AdminClientDetail as AdminClientDetailRecord,
} from "@/lib/clients.functions";
import { getAdminFormTemplates } from "@/lib/admin.functions";
import { canonicalUrl } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/clients/$clientId")({
  beforeLoad: async ({ location }) => {
    await requireBrowserAdmin(location.href);
  },
  loader: async ({ params }) => {
    const [client, assessmentTemplates] = await Promise.all([
      getAdminClientDetail({ data: { clientId: params.clientId } }),
      getAdminFormTemplates(),
    ]);
    if (!client) throw redirect({ href: "/admin/clients?error=not-found" });
    return { client, assessmentTemplates };
  },
  head: ({ params }) => ({
    meta: [
      { title: "Client details | Talk Space Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl(`/admin/clients/${params.clientId}`) }],
  }),
  component: ClientDetailRoute,
});

function ClientDetailRoute() {
  const { client, assessmentTemplates } = Route.useLoaderData();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void hasBrowserRole("admin").then((isAdmin) => {
      if (active) setAuthorized(isAdmin);
    });
    return () => {
      active = false;
    };
  }, []);

  if (authorized === null) return <AdminClientDetailSkeleton />;
  if (!authorized) {
    return (
      <main id="main" className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="display-1 text-brand-deep">Permission required</h1>
        <p className="mt-4 text-muted-foreground">
          You do not have permission to view client records.
        </p>
      </main>
    );
  }

  return (
    <AdminClientDetail
      client={client as AdminClientDetailRecord}
      assessmentTemplates={assessmentTemplates}
    />
  );
}
