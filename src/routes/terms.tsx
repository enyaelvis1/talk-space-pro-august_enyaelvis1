import { createFileRoute } from "@tanstack/react-router";

import { AdminPageEditLayer } from "@/components/site/AdminPageEditLayer";
import { EditablePublicPage } from "@/components/site/EditablePublicPage";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getPublishedEntry } from "@/lib/content.functions";
import { canonicalUrl, pageSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/terms")({
  loader: async () => {
    const entry = await getPublishedEntry({ data: { kind: "page", slug: "terms" } });
    return { entry };
  },
  head: ({ loaderData }) => ({
    ...pageSeoHead({
      path: "/terms",
      title: "Terms of Service | Talk Space Counselling Services",
      description: "The terms that govern your use of Talk Space Counselling Services in Nigeria.",
      ogTitle: "Terms of Service | Talk Space",
      ogDescription: "The terms that govern use of Talk Space.",
      entry: loaderData?.entry ?? null,
    }),
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { entry } = Route.useLoaderData();
  if (entry) {
    return <EditablePublicPage entry={entry} label="Terms" />;
  }

  return (
    <AdminPageEditLayer slug="terms" label="Terms">
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <SiteBreadcrumbs />
        <main id="main" className="flex-1">
          <section className="bg-surface-page">
            <div className="mx-auto w-full max-w-3xl px-4 pt-16 pb-10 sm:px-6 lg:px-8 lg:pt-24">
              <p className="eyebrow">Legal</p>
              <h1 className="display-1 mt-4 text-brand-deep">Terms of Service</h1>
              <p className="mt-4 text-sm text-muted-foreground">Last updated: 1 January 2026</p>
            </div>
          </section>

          <section className="bg-white pb-24">
            <article className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
              <Prose title="About these terms">
                These terms govern your use of Talk Space Counselling Services (“Talk Space”). By
                booking a session or using our website you agree to them. If you do not agree,
                please do not use the service.
              </Prose>
              <Prose title="Not an emergency service">
                Talk Space is not a crisis or emergency service. If you or someone you know is at
                immediate risk, call 112 or use the numbers on our emergency support page.
              </Prose>
              <Prose title="Who can use Talk Space">
                You must be 18 or over to book for yourself. Sessions for minors (13-17) must be
                booked by a parent or legal guardian, who will sign our consent forms.
              </Prose>
              <Prose title="Sessions and payment">
                Fees are shown on our pricing page and confirmed before your session. Payment is
                taken only after your session is confirmed. Sliding-scale slots are limited and
                awarded at our discretion.
              </Prose>
              <Prose title="Cancellations and refunds">
                You can reschedule up to 48 hours before your session at no charge. Please see our
                cancellation and refund policy for the full detail.
              </Prose>
              <Prose title="Your responsibilities">
                You agree to give accurate information at booking, to attend sessions in an
                environment where you feel safe and undisturbed, and to not record sessions without
                your therapist's consent.
              </Prose>
              <Prose title="Limitation of liability">
                Talk Space provides counselling but cannot guarantee specific outcomes. Our
                liability for loss arising from use of the service is limited to fees paid in the
                twelve months before the event giving rise to the claim.
              </Prose>
              <Prose title="Governing law">
                These terms are governed by the laws of the Federal Republic of Nigeria. Disputes
                are subject to the exclusive jurisdiction of the courts of Lagos State.
              </Prose>
            </article>
          </section>
        </main>
        <SiteFooter />
      </div>
    </AdminPageEditLayer>
  );
}

function Prose({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-brand-deep">{title}</h2>
      <p className="mt-3 text-muted-foreground">{children}</p>
    </section>
  );
}
