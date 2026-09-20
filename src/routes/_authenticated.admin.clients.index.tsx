import { createFileRoute, redirect } from "@tanstack/react-router";

import { AdminClients } from "@/components/admin/AdminClients";
import { getAdminClients } from "@/lib/clients.functions";
import { canonicalUrl } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/clients/")({
  loader: async () => {
    const clients = await getAdminClients();
    if (!clients) throw redirect({ href: "/account?error=forbidden" });
    return clients;
  },
  head: () => ({
    meta: [
      { title: "Clients | Talk Space Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/clients") }],
  }),
  component: ClientsIndexRoute,
});

function ClientsIndexRoute() {
  const clients = Route.useLoaderData();
  return <AdminClients clients={clients} />;
}
