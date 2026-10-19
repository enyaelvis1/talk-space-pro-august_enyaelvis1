import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { pageSeoHead } from "@/lib/seo";

const SERVICE_PAGES = {
  "individual-therapy": {
    title: "Individual Therapy",
    summary:
      "Private, practical support for anxiety, grief, burnout, identity and life transitions.",
    body: "Individual therapy gives you a confidential space to understand what is happening, build useful tools and make sustainable changes with a qualified Talk Space therapist.",
  },
  "couple-therapy": {
    title: "Couple Therapy",
    summary: "Structured support for communication, trust, conflict and emotional intimacy.",
    body: "Couple therapy helps partners slow down repeated conflict, understand each other more clearly and practise healthier ways to repair and reconnect.",
  },
  "teen-child-therapy": {
    title: "Teen and Child Therapy",
    summary: "Age-appropriate care for emotional, behavioural, school and family challenges.",
    body: "Our clinicians work with younger clients and their caregivers using developmentally appropriate approaches. Sessions are 60 minutes unless a clinician recommends otherwise.",
  },
  "premarital-counselling": {
    title: "Premarital Counselling",
    summary: "Prepare for marriage with clearer expectations, communication and shared plans.",
    body: "Premarital counselling creates a guided space to explore values, family boundaries, finances, conflict and the practical shape of your future together.",
  },
  "family-therapy": {
    title: "Family Therapy",
    summary: "Support for families navigating conflict, transitions and changing relationships.",
    body: "Family therapy brings the people most affected into a structured conversation so patterns can be understood and safer ways of relating can be practised.",
  },
} as const;

export const Route = createFileRoute("/services/$slug")({
  loader: ({ params }) => {
    const page = SERVICE_PAGES[params.slug as keyof typeof SERVICE_PAGES];
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData, params }) =>
    pageSeoHead({
      path: `/services/${params.slug}`,
      title: `${loaderData?.title ?? "Therapy service"} | Talk Space`,
      description: loaderData?.summary ?? "Talk Space counselling services.",
    }),
  component: ServiceLandingPage,
});

function ServiceLandingPage() {
  const page = Route.useLoaderData();
  return (
    <div className="flex min-h-screen flex-col bg-surface-page">
      <SiteHeader />
      <SiteBreadcrumbs items={[{ label: "Services", to: "/services" }, { label: page.title }]} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16 sm:px-6 lg:px-8">
        <p className="eyebrow">Talk Space service</p>
        <h1 className="display-1 mt-3 max-w-3xl text-brand-deep">{page.title}</h1>
        <p className="mt-6 max-w-2xl text-xl text-muted-foreground">{page.summary}</p>
        <div className="mt-10 grid gap-8 md:grid-cols-[1fr_20rem]">
          <article className="rounded-3xl border border-border/70 bg-white p-7 shadow-soft-warm">
            <p className="leading-8 text-brand-deep">{page.body}</p>
            <p className="mt-5 leading-8 text-muted-foreground">
              Sessions are available online and, where offered, in person in Lagos. We will help you
              choose the right therapist and next step during booking.
            </p>
            <Button asChild className="mt-8 bg-brand-deep text-white hover:bg-brand-deep/90">
              <Link to="/book">Book a session</Link>
            </Button>
          </article>
          <aside className="rounded-3xl border border-border/70 bg-brand-blue-soft/40 p-7">
            <h2 className="font-display text-xl text-brand-deep">Need help choosing?</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Book a paid 15-minute Clarity Call for service-fit guidance.
            </p>
            <Link
              className="mt-5 inline-block text-sm font-semibold text-link underline"
              to="/services"
            >
              View all services
            </Link>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
