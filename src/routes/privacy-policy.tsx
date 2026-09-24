import { createFileRoute } from "@tanstack/react-router";

import { AdminPageEditLayer } from "@/components/site/AdminPageEditLayer";
import { EditablePublicPage } from "@/components/site/EditablePublicPage";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getPublishedEntry } from "@/lib/content.functions";
import { canonicalUrl, pageSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/privacy-policy")({
  loader: async () => {
    const entry = await getPublishedEntry({ data: { kind: "page", slug: "privacy-policy" } });
    return { entry };
  },
  head: ({ loaderData }) => ({
    ...pageSeoHead({
      path: "/privacy-policy",
      title: "Privacy Policy | Talk Space Counselling Services",
      description:
        "How Talk Space Counselling Services collects, uses and protects your personal and clinical information.",
      ogTitle: "Privacy Policy | Talk Space",
      ogDescription: "How we collect, use and protect your data.",
      entry: loaderData?.entry ?? null,
    }),
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { entry } = Route.useLoaderData();
  if (entry) {
    return <EditablePublicPage entry={entry} label="Privacy policy" />;
  }

  return (
    <AdminPageEditLayer slug="privacy-policy" label="Privacy policy">
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <SiteBreadcrumbs />
        <main id="main" className="flex-1">
          <section className="bg-surface-page">
            <div className="mx-auto w-full max-w-3xl px-4 pt-16 pb-10 sm:px-6 lg:px-8 lg:pt-24">
              <p className="eyebrow">Legal</p>
              <h1 className="display-1 mt-4 text-brand-deep">Privacy Policy</h1>
              <p className="mt-4 text-sm text-muted-foreground">Last updated: 1 January 2026</p>
            </div>
          </section>

          <section className="bg-white pb-24">
            <article className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
              <Prose title="Who we are">
                Talk Space Counselling Services Ltd (“Talk Space”, “we”, “us”) is a Nigerian
                mental-health provider registered in Lagos. This policy explains how we handle your
                personal and health information under the Nigeria Data Protection Act 2023 (NDPA).
              </Prose>
              <Prose title="What we collect">
                We collect the details you share when booking or attending a session (name, contact
                details, brief clinical notes), technical information from our website (device, IP,
                cookies for essential functionality), and payment references from our payment
                processor. We do not collect payment card numbers directly.
              </Prose>
              <Prose title="How we use it">
                We use your information to deliver the counselling you have asked for, to schedule
                and bill sessions, to keep clinical records as required by professional standards,
                and to respond when you contact us. Aggregated, de-identified data may be used to
                improve our services.
              </Prose>
              <Prose title="Confidentiality">
                Sessions are private and protected by professional ethics. We only share information
                with your explicit consent, or where required by law, for example, a real and
                imminent risk to life, or a valid court order. Where possible, we tell you first.
              </Prose>
              <Prose title="How we protect it">
                We use encrypted video, encrypted storage and role-based access. Clinical notes are
                accessible only to your therapist and, where needed for care, a named clinical
                supervisor. Staff are trained on data protection annually.
              </Prose>
              <Prose title="Your rights">
                You can ask us for a copy of the personal data we hold about you, correct anything
                inaccurate, withdraw consent, or ask us to delete data we no longer need to keep.
                Email privacy@talkspace.ng and we will respond within 30 days.
              </Prose>
              <Prose title="Contact">
                Questions about this policy? Email privacy@talkspace.ng or write to the Data
                Protection Officer, Talk Space Counselling Services, Abiodun Oshowole Cl, off
                Oluwaleimu Street, Allen, Ikeja 101233, Lagos.
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
