import { createFileRoute, notFound } from "@tanstack/react-router";

import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Link } from "@tanstack/react-router";
import { locationPageJsonLd, pageSeoHead } from "@/lib/seo";
import { TS } from "@/lib/talkspace";

const LOCATIONS = {
  lagos: {
    name: "Lagos",
    detail: "Online counselling and in-person sessions by appointment in Allen, Ikeja.",
    address: TS.addresses.find((address) => address.city.includes("Lagos"))?.lines,
  },
  abuja: {
    name: "Abuja",
    detail:
      "Online counselling for clients in Abuja, with in-person availability at T-Pumpy Estate confirmed during booking.",
    address: TS.addresses.find((address) => address.city.includes("Abuja"))?.lines,
  },
} as const;

export const Route = createFileRoute("/locations/$city")({
  loader: ({ params }) => {
    const location = LOCATIONS[params.city as keyof typeof LOCATIONS];
    if (!location) throw notFound();
    return location;
  },
  head: ({ loaderData, params }) => {
    const name = loaderData?.name ?? "Nigeria";
    const description = `${loaderData?.detail ?? "Confidential counselling with Talk Space."} Book online or ask about availability.`;
    return {
      ...pageSeoHead({
        path: `/locations/${params.city}`,
        title: `Counselling in ${name} | Talk Space`,
        description,
      }),
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(
            locationPageJsonLd({
              name,
              description,
              path: `/locations/${params.city}`,
              address: loaderData?.address,
            }),
          ),
        },
      ],
    };
  },
  component: LocationPage,
});

function LocationPage() {
  const location = Route.useLoaderData();
  return (
    <div className="flex min-h-screen flex-col bg-surface-page">
      <SiteHeader />
      <SiteBreadcrumbs items={[{ label: "Locations" }, { label: location.name }]} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16 sm:px-6 lg:px-8">
        <p className="eyebrow">Talk Space in Nigeria</p>
        <h1 className="display-1 mt-3 text-brand-deep">Counselling in {location.name}</h1>
        <p className="mt-6 max-w-2xl text-xl text-muted-foreground">{location.detail}</p>
        <div className="mt-10 rounded-3xl border border-border/70 bg-white p-8 shadow-soft-warm">
          <p className="leading-8 text-brand-deep">
            Choose online or in-person preferences when you book. Our team will confirm the
            therapist, location and next steps before your appointment. In-person sessions are
            appointment-only; online sessions are available to clients across Nigeria.
          </p>
          <Link
            className="mt-7 inline-block rounded-full bg-brand-deep px-5 py-3 text-sm font-semibold text-white"
            to="/book"
          >
            Book a session
          </Link>
          <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <Link className="text-link underline" to="/services">
              Explore services
            </Link>
            <Link className="text-link underline" to="/pricing">
              View pricing
            </Link>
            <Link className="text-link underline" to="/contact">
              Confirm availability
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
