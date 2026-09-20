import { createFileRoute, Link } from "@tanstack/react-router";

import { AdminPageEditLayer } from "@/components/site/AdminPageEditLayer";
import { EditablePublicPage } from "@/components/site/EditablePublicPage";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getPublishedEntry } from "@/lib/content.functions";
import { canonicalUrl, pageSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/cancellation-refund-policy")({
  loader: async () => {
    const entry = await getPublishedEntry({
      data: { kind: "page", slug: "cancellation-refund-policy" },
    });
    return { entry };
  },
  head: ({ loaderData }) => ({
    ...pageSeoHead({
      path: "/cancellation-refund-policy",
      title: "Cancellation & Refund Policy | Talk Space",
      description:
        "How rescheduling, cancellations and refunds work for Talk Space counselling sessions.",
      ogTitle: "Cancellation & Refund Policy | Talk Space",
      ogDescription: "Rescheduling, cancellations and refunds at Talk Space.",
      entry: loaderData?.entry ?? null,
    }),
  }),
  component: RouteComponent,
});

const ROWS = [
  {
    when: "At least 48 hours before",
    fee: "No charge",
    note: "Reschedule or cancel by email, WhatsApp, phone call, or your booking link.",
  },
  {
    when: "Below 48 hours before, or no-show",
    fee: "Full session fee forfeited",
    note: "Late changes are not accepted because your therapist's time is already committed.",
  },
];

function RouteComponent() {
  const { entry } = Route.useLoaderData();
  if (entry) {
    return <EditablePublicPage entry={entry} label="Cancellation & refund policy" />;
  }

  return (
    <AdminPageEditLayer slug="cancellation-refund-policy" label="Cancellation & refund policy">
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <SiteBreadcrumbs />
        <main id="main" className="flex-1">
          <section className="bg-surface-page">
            <div className="mx-auto w-full max-w-3xl px-4 pt-16 pb-10 sm:px-6 lg:px-8 lg:pt-24">
              <p className="eyebrow">Legal</p>
              <h1 className="display-1 mt-4 text-brand-deep">Cancellation & refund policy</h1>
              <p className="mt-4 text-sm text-muted-foreground">Last updated: 1 January 2026</p>
            </div>
          </section>

          <section className="bg-white pb-24">
            <div className="mx-auto max-w-3xl space-y-10 px-4 py-10 sm:px-6 lg:px-8">
              <p className="text-muted-foreground">
                We hold your therapist's time exclusively for you. This policy helps us keep fees
                affordable while respecting our clinicians' schedules. Please contact us by email,
                WhatsApp, phone call, or your booking link at least 48 hours before your session if
                you need to reschedule or cancel.
              </p>

              <div className="overflow-hidden rounded-2xl border border-border/70">
                <table className="w-full text-sm">
                  <thead className="bg-surface-page text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">When you tell us</th>
                      <th className="px-4 py-3">Fee</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/70 bg-card">
                    {ROWS.map((r) => (
                      <tr key={r.when} className="align-top">
                        <td className="px-4 py-4 font-medium text-brand-deep">{r.when}</td>
                        <td className="ref-mono px-4 py-4 text-brand-deep">{r.fee}</td>
                        <td className="px-4 py-4 text-muted-foreground">{r.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <section>
                <h2 className="text-xl font-semibold text-brand-deep">Refunds on plans</h2>
                <p className="mt-3 text-muted-foreground">
                  For multi-session plans, unused sessions are refundable within 60 days of
                  purchase, pro-rated at the single-session rate. Refunds are processed within 7
                  working days to the original payment method.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-brand-deep">Group cohorts</h2>
                <p className="mt-3 text-muted-foreground">
                  Group fees are refundable in full up to 7 days before the cohort begins. After
                  that, we can transfer your place to the next cohort but cannot refund the fee, as
                  facilitator time and materials are committed.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-brand-deep">Ask us anything</h2>
                <p className="mt-3 text-muted-foreground">
                  If a fee has been applied that you'd like to discuss, please email
                  hello@talkspace.ng or{" "}
                  <Link to="/contact" className="text-link">
                    contact us
                  </Link>
                  . We review every request individually.
                </p>
              </section>
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    </AdminPageEditLayer>
  );
}
