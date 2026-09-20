import { createFileRoute, redirect } from "@tanstack/react-router";

import { AdminAvailability } from "@/components/admin/AdminAvailability";
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
  return <AdminAvailability data={availability} />;
}
