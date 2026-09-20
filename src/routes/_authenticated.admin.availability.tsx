import { useEffect, useState } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { AdminAvailability, AdminAvailabilitySkeleton } from "@/components/admin/AdminAvailability";
import { hasBrowserRole } from "@/lib/auth";
import { getAdminAvailability } from "@/lib/availability.functions";
import { canonicalUrl } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/availability")({
  loader: async () => {
    const availability = await getAdminAvailability();
    if (!availability) throw redirect({ href: "/account?error=forbidden" });
    return availability;
  },
  head: () => ({
    meta: [
      { title: "Availability | Talk Space Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: canonicalUrl("/admin/availability") }],
  }),
  component: AvailabilityRoute,
});

function AvailabilityRoute() {
  const availability = Route.useLoaderData();
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

  if (authorized === null) return <AdminAvailabilitySkeleton />;
  if (!authorized) {
    return (
      <main id="main" className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="display-1 text-brand-deep">Permission required</h1>
        <p className="mt-4 text-muted-foreground">
          You do not have permission to manage therapist availability.
        </p>
      </main>
    );
  }

  return <AdminAvailability data={availability} />;
}
