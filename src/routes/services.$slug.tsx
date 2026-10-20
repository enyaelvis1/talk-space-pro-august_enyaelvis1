import { createFileRoute, Link, notFound } from "@tanstack/react-router";

import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { pageSeoHead, servicePageJsonLd } from "@/lib/seo";
import { SERVICE_CATALOG, durationLabel } from "@/lib/service-catalog";

const SERVICE_PAGES = {
  "individual-therapy": {
    title: "Individual Therapy",
    summary:
      "Private, practical support for anxiety, grief, burnout, identity and life transitions.",
    body: `Individual therapy gives you a confidential space to understand what is happening, build useful tools and make sustainable changes with a qualified Talk Space therapist. Sessions are ${durationLabel(SERVICE_CATALOG.individual.durationMinutes)}.`,
    audience: "Adults seeking individual support for current concerns or life transitions.",
    format: "Online video or in-person where available; 60-minute sessions.",
    concerns: ["Anxiety and stress", "Grief and loss", "Burnout and life transitions"],
    related: ["couple-therapy", "family-therapy"],
  },
  "couple-therapy": {
    title: "Couple Therapy",
    summary: "Structured support for communication, trust, conflict and emotional intimacy.",
    body: `Couple therapy helps partners slow down repeated conflict, understand each other more clearly and practise healthier ways to repair and reconnect. Sessions are ${durationLabel(SERVICE_CATALOG.couple.durationMinutes)}.`,
    audience: "Partners who want structured support for communication, repair, trust or intimacy.",
    format: "Joint online video or in-person sessions; 90-minute sessions.",
    concerns: ["Communication and conflict", "Trust and repair", "Parenting or family differences"],
    related: ["premarital-counselling", "individual-therapy"],
  },
  "teen-child-therapy": {
    title: "Teen and Child Therapy",
    summary: "Age-appropriate care for emotional, behavioural, school and family challenges.",
    body: `Our clinicians work with younger clients and their caregivers using developmentally appropriate approaches. Sessions are ${durationLabel(SERVICE_CATALOG.teenChild.durationMinutes)} unless a clinician recommends otherwise.`,
    audience: "Children and teenagers, with caregiver involvement appropriate to age and need.",
    format: "Online or in-person where available; 60-minute sessions.",
    concerns: [
      "Emotional regulation",
      "School-related stress",
      "Behavioural or family transitions",
    ],
    related: ["family-therapy", "individual-therapy"],
  },
  "premarital-counselling": {
    title: "Premarital Counselling",
    summary: "Prepare for marriage with clearer expectations, communication and shared plans.",
    body: "Premarital counselling creates a guided space to explore values, family boundaries, finances, conflict and the practical shape of your future together.",
    audience: "Engaged or seriously committed partners preparing for marriage.",
    format: "Joint online or in-person sessions; 90-minute sessions.",
    concerns: ["Expectations and values", "Family boundaries", "Finances and conflict"],
    related: ["couple-therapy", "family-therapy"],
  },
  "family-therapy": {
    title: "Family Therapy",
    summary: "Support for families navigating conflict, transitions and changing relationships.",
    body: "Family therapy brings the people most affected into a structured conversation so patterns can be understood and safer ways of relating can be practised.",
    audience: "Families navigating conflict, transitions or changing relationships.",
    format: "Online or in-person where available; session length confirmed during booking.",
    concerns: ["Family conflict", "Parenting differences", "Blended-family transitions"],
    related: ["couple-therapy", "teen-child-therapy"],
  },
} as const;

export const Route = createFileRoute("/services/$slug")({
  loader: ({ params }) => {
    const page = SERVICE_PAGES[params.slug as keyof typeof SERVICE_PAGES];
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData, params }) => {
    const title = loaderData?.title ?? "Therapy service";
    const description = loaderData?.summary ?? "Talk Space counselling services.";
    return {
      ...pageSeoHead({
        path: `/services/${params.slug}`,
        title: `${title} | Talk Space`,
        description,
      }),
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(
            servicePageJsonLd({ name: title, description, path: `/services/${params.slug}` }),
          ),
        },
      ],
    };
  },
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
              {page.format} We will help you choose the right therapist and next step during
              booking.
            </p>
            <h2 className="mt-8 font-display text-xl text-brand-deep">Who this may help</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">{page.audience}</p>
            <h2 className="mt-8 font-display text-xl text-brand-deep">Common reasons people ask</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-muted-foreground">
              {page.concerns.map((concern) => (
                <li key={concern}>{concern}</li>
              ))}
            </ul>
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
        <section className="mt-12 rounded-3xl border border-border/70 bg-white p-7 shadow-soft-warm">
          <h2 className="font-display text-xl text-brand-deep">Before you book</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
            Read our{" "}
            <Link to="/pricing" className="font-semibold text-link underline">
              current pricing
            </Link>
            ,
            <Link to="/faqs" className="font-semibold text-link underline">
              {" "}
              frequently asked questions
            </Link>
            , and{" "}
            <Link to="/privacy-policy" className="font-semibold text-link underline">
              privacy policy
            </Link>
            . Therapist matching, availability and in-person location are confirmed during the
            secure booking process.
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm">
            {page.related.map((slug) => (
              <Link
                key={slug}
                to="/services/$slug"
                params={{ slug }}
                className="text-link underline"
              >
                Explore related support
              </Link>
            ))}
            <Link to="/therapists" className="text-link underline">
              Meet the therapist team
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
