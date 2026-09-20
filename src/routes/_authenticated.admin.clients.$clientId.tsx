import { createFileRoute, redirect } from "@tanstack/react-router";

import { AdminClientDetail } from "@/components/admin/AdminClientDetail";
import { requireBrowserAdmin } from "@/lib/auth";
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
  return (
    <AdminClientDetail
      client={client as AdminClientDetailRecord}
      assessmentTemplates={assessmentTemplates}
    />
  );
}
