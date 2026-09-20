import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { AdminClients, AdminClientsSkeleton } from "@/components/admin/AdminClients";
import { hasBrowserRole } from "@/lib/auth";
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

  if (authorized === null) return <AdminClientsSkeleton />;
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

  return <AdminClients clients={clients} />;
}
