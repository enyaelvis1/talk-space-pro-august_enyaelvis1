import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Clock, LifeBuoy, Phone, ShieldCheck, Users } from "lucide-react";

import { AdminPageEditLayer } from "@/components/site/AdminPageEditLayer";
import { EditablePublicPage } from "@/components/site/EditablePublicPage";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { getPublishedEntry } from "@/lib/content.functions";
import { canonicalUrl, pageSeoHead } from "@/lib/seo";

type CrisisLine = {
  name: string;
  numbers: { label: string; href: string }[];
  hours: string;
  scope: string;
  featured?: boolean;
};

const LINES: CrisisLine[] = [
  {
    name: "Nigeria Emergency Services",
    numbers: [{ label: "112", href: "tel:112" }],
    hours: "24 hours, 7 days a week",
    scope: "Police, ambulance, fire and rescue",
    featured: true,
  },
  {
    name: "Mentally Aware Nigeria (MANI)",
    numbers: [{ label: "0809 210 6493", href: "tel:+2348092106493" }],
    hours: "24 hours, 7 days a week",
    scope: "Mental health crisis and emotional distress",
  },
  {
    name: "Suicide Research and Prevention Initiative (SURPIN)",
    numbers: [
      { label: "0806 210 6493", href: "tel:+2348062106493" },
      { label: "0809 210 6493", href: "tel:+2348092106493" },
    ],
    hours: "24 hours, 7 days a week",
    scope: "Suicide prevention and crisis intervention",
  },
  {
    name: "Lagos State Domestic and Sexual Violence Agency",
    numbers: [{ label: "0813 796 0048", href: "tel:+2348137960048" }],
    hours: "24 hours, 7 days a week",
    scope: "Domestic violence, sexual assault and abuse support",
  },
];

const WHAT_TO_EXPECT = [
  {
    icon: Phone,
    title: "Pick up the phone",
    desc: "Dial the number that matches your situation. All calls are free.",
  },
  {
    icon: Users,
    title: "Speak to a responder",
    desc: "A trained crisis responder will listen, assess and guide you to safety.",
  },
  {
    icon: ShieldCheck,
    title: "Your call is confidential",
    desc: "Crisis lines do not share your identity or details without your consent.",
  },
  {
    icon: Clock,
    title: "Stay on the line",
    desc: "If life is at immediate risk, call 112 and stay on the line until help arrives.",
  },
];

export const Route = createFileRoute("/emergency-support")({
  loader: async () => {
    const entry = await getPublishedEntry({ data: { kind: "page", slug: "emergency-support" } });
    return { entry };
  },
  head: ({ loaderData }) => ({
    ...pageSeoHead({
      path: "/emergency-support",
      title: "Emergency Support | Crisis Lines in Nigeria",
      description:
        "Talk Space is not an emergency service. If you or someone you know is in crisis, please use these Nigerian crisis lines and emergency numbers.",
      ogTitle: "Emergency Support | Talk Space",
      ogDescription: "Nigerian crisis lines and emergency numbers.",
      entry: loaderData?.entry ?? null,
    }),
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { entry } = Route.useLoaderData();
  if (entry) {
    return <EditablePublicPage entry={entry} label="Emergency support" />;
  }

  return (
    <AdminPageEditLayer slug="emergency-support" label="Emergency support">
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <SiteBreadcrumbs />

        {/* Urgency banner */}
        <div className="bg-destructive">
          <div className="mx-auto flex max-w-7xl items-start gap-3 px-4 py-4 sm:items-center sm:px-6 lg:px-8">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-destructive-foreground sm:mt-0"
              aria-hidden
            />
            <p className="text-sm font-medium text-destructive-foreground sm:text-base">
              Talk Space is not an emergency service. If you or someone you know is in immediate
              danger, use the numbers on this page.
            </p>
          </div>
        </div>

        <main id="main" className="flex-1">
          {/* Hero */}
          <section className="bg-surface-page">
            <div className="mx-auto w-full max-w-7xl px-4 pt-10 pb-6 sm:px-6 sm:pt-14 lg:px-8 lg:pt-20">
              <h1 className="display-1 max-w-3xl text-brand-deep">
                If you or someone you know is in immediate danger, call for help now.
              </h1>
              <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
                These Nigerian crisis lines are free, confidential and answered by trained
                responders. If life is at immediate risk, dial{" "}
                <strong className="text-foreground">112</strong> and stay on the line.
              </p>
            </div>
          </section>

          {/* Crisis lines */}
          <section className="bg-surface-page pb-6 sm:pb-10" aria-label="Crisis lines">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
              <ul className="grid gap-4 sm:gap-5 md:grid-cols-2">
                {LINES.map((line) => (
                  <li
                    key={line.name}
                    className={`rounded-2xl border p-6 transition-colors sm:p-8 ${
                      line.featured
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-border/70 bg-card hover:border-brand-deep/30 hover:bg-brand-blue-soft/30"
                    }`}
                  >
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {line.featured && (
                            <span className="inline-flex items-center rounded-full bg-destructive px-2.5 py-0.5 text-xs font-semibold text-destructive-foreground">
                              Emergency
                            </span>
                          )}
                          <h2 className="text-base font-semibold text-brand-deep sm:text-lg">
                            {line.name}
                          </h2>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {line.numbers.map((n) => (
                            <a
                              key={n.href}
                              href={n.href}
                              className="ref-mono inline-flex items-center gap-2 rounded-lg bg-brand-deep px-4 py-3 text-lg font-semibold text-white transition-colors hover:bg-brand-deep/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                              aria-label={`Call ${line.name} on ${n.label}`}
                            >
                              <Phone className="h-4 w-4" aria-hidden />
                              {n.label}
                            </a>
                          ))}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" aria-hidden />
                            {line.hours}
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <LifeBuoy className="h-3.5 w-3.5" aria-hidden />
                            {line.scope}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* What to expect */}
          <section className="border-t border-border/60 bg-white py-12 sm:py-16">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
              <h2 className="text-brand-deep">What to expect when you call</h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                It is normal to feel nervous. Crisis responders are trained to help you through the
                first steps calmly and quickly.
              </p>

              <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {WHAT_TO_EXPECT.map((item, i) => (
                  <li
                    key={item.title}
                    className="rounded-2xl border border-border/70 bg-surface-page p-6"
                  >
                    <span
                      aria-hidden
                      className="grid h-10 w-10 place-items-center rounded-xl bg-brand-mint-soft text-brand-deep"
                    >
                      <item.icon className="h-5 w-5" />
                    </span>
                    <p className="mt-4 text-sm font-semibold text-brand-deep">
                      <span className="sr-only">Step {i + 1}: </span>
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.desc}</p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* After crisis */}
          <section className="bg-surface-page py-12 sm:py-16">
            <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
              <span
                aria-hidden
                className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-brand-mint-soft text-brand-deep"
              >
                <ShieldCheck className="h-6 w-6" />
              </span>
              <h2 className="mt-5 text-brand-deep">Once the crisis has passed</h2>
              <p className="mt-3 text-muted-foreground">
                Therapy is one of the most helpful next steps. Talk Space can match you with a
                licensed therapist within one working day.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Button asChild className="bg-brand-deep px-6 text-white hover:bg-brand-deep/90">
                  <Link to="/book">Book a session</Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="border-brand-deep/20 text-brand-deep hover:bg-brand-blue-soft"
                >
                  <Link to="/contact">Talk to our team</Link>
                </Button>
              </div>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </AdminPageEditLayer>
  );
}
