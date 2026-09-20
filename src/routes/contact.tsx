import { createFileRoute } from "@tanstack/react-router";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";

import { AdminPageEditLayer } from "@/components/site/AdminPageEditLayer";
import { EditablePublicPage } from "@/components/site/EditablePublicPage";
import { ContactEnquiryForm } from "@/components/site/ContactEnquiryForm";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SectionBadge } from "@/components/site/SectionBadge";
import { Reveal } from "@/components/site/Reveal";
import { StoreLocatorMap } from "@/components/site/StoreLocatorMap";
import { Button } from "@/components/ui/button";
import { DEFAULT_FORM_TEMPLATES, getLatestTemplateByBaseKey } from "@/lib/form-templates";
import { TS, WHATSAPP_HREF } from "@/lib/talkspace";
import { LOCAL_BUSINESS_JSON_LD, canonicalUrl, pageSeoHead } from "@/lib/seo";
import { getPublishedEntry, getPublicFormTemplates } from "@/lib/content.functions";

export const Route = createFileRoute("/contact")({
  loader: async () => ({
    templates: await getPublicFormTemplates(),
    entry: await getPublishedEntry({ data: { kind: "page", slug: "contact" } }),
  }),
  head: ({ loaderData }) => ({
    ...pageSeoHead({
      path: "/contact",
      title: "Contact Talk Space | WhatsApp, phone, Lagos & Abuja offices",
      description:
        "Reach Talk Space Counselling Services by WhatsApp, phone or email. Offices in Lagos (Gbagada) and Abuja (T-Pumpy Estate). Mon-Fri, 9am-5pm WAT.",
      ogTitle: "Contact Talk Space",
      ogDescription: "WhatsApp, phone and email. Offices in Lagos and Abuja.",
      entry: loaderData?.entry ?? null,
    }),
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(LOCAL_BUSINESS_JSON_LD),
      },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { entry, templates } = Route.useLoaderData();
  if (entry) {
    return <EditablePublicPage entry={entry} label="Contact" afterSections={<StoreLocatorMap />} />;
  }

  const contactTemplate =
    getLatestTemplateByBaseKey(templates, "contact_enquiry") ??
    DEFAULT_FORM_TEMPLATES.find((template) => template.key === "contact_enquiry_v1")!;
  return (
    <AdminPageEditLayer slug="contact" label="Contact">
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <SiteBreadcrumbs />
        <main id="main" className="flex-1">
          <section className="bg-surface-cream">
            <div className="mx-auto w-full max-w-7xl px-4 pt-16 pb-14 sm:px-6 lg:px-8 lg:pt-24">
              <Reveal className="flex flex-col items-center text-center">
                <SectionBadge>Get in touch</SectionBadge>
                <h1 className="display-1 mt-6 max-w-3xl text-brand-deep">
                  A calm place to <span className="italic text-accent-terracotta">reach us</span>.
                </h1>
                <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
                  Our care team responds within one working day. If you are in a crisis right now,
                  please see our{" "}
                  <a href="/emergency-support" className="text-link">
                    emergency support page
                  </a>
                  .
                </p>
              </Reveal>
            </div>
          </section>

          <section className="bg-surface-page pb-24 pt-12 sm:pt-14 lg:pt-16">
            <div className="mx-auto grid w-full max-w-[86rem] items-stretch gap-x-7 gap-y-10 px-4 sm:px-6 lg:grid-cols-3 lg:px-8 xl:gap-x-8 xl:gap-y-12">
              <Card
                icon={WhatsAppIcon}
                title="WhatsApp"
                value={TS.phone.whatsapp}
                cta={{ label: "Open in WhatsApp", href: WHATSAPP_HREF, external: true }}
                note="Fastest response · Mon-Fri, 9am-5pm"
              />
              <Card
                icon={Phone}
                title="Phone (Nigeria)"
                value={TS.phone.ng}
                cta={{ label: "Call now", href: TS.phone.ngHref }}
                note="Mon-Fri, 9am-5pm WAT"
              />
              <Card
                icon={Mail}
                title="Email"
                value={TS.email}
                cta={{ label: "Send an email", href: `mailto:${TS.email}` }}
                note="Replies within one working day"
              />
            </div>

            <div className="mx-auto mt-10 grid w-full max-w-[86rem] items-stretch gap-x-7 gap-y-10 px-4 sm:px-6 lg:grid-cols-3 lg:px-8 xl:mt-12 xl:gap-x-8 xl:gap-y-12">
              {TS.addresses.map((addr) => (
                <Reveal
                  key={addr.city}
                  className="flex h-full min-h-[306px] flex-col rounded-[1.75rem] border border-border/70 bg-surface-card p-8 shadow-soft-warm sm:p-9 lg:min-h-[258px] lg:p-10"
                >
                  <span className="grid size-10 place-items-center rounded-full bg-accent-terracotta-soft text-accent-terracotta">
                    <MapPin className="size-5" />
                  </span>
                  <h2 className="mt-7 font-display text-xl text-brand-deep">{addr.city}</h2>
                  <p className="mt-3 text-sm font-bold leading-6 text-muted-foreground">
                    {addr.lines.map((line, i) => (
                      <span key={i}>
                        {line}
                        {i < addr.lines.length - 1 && <br />}
                      </span>
                    ))}
                  </p>
                  <p className="mt-auto pt-6 text-xs font-bold leading-5 text-muted-foreground">
                    In-person sessions by appointment only.
                  </p>
                </Reveal>
              ))}
              <Reveal className="flex h-full min-h-[306px] flex-col rounded-[1.75rem] border border-border/70 bg-surface-card p-8 shadow-soft-warm sm:p-9 lg:min-h-[258px] lg:p-10">
                <span className="grid size-10 place-items-center rounded-full bg-accent-terracotta-soft text-accent-terracotta">
                  <Clock className="size-5" />
                </span>
                <h2 className="mt-7 font-display text-xl text-brand-deep">Hours</h2>
                <dl className="mt-4 space-y-1.5 text-sm text-brand-deep">
                  <div className="grid grid-cols-[1fr_auto] gap-4">
                    <dt className="font-bold">Monday to Friday</dt>
                    <dd className="ref-mono">9:00 to 17:00</dd>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-4">
                    <dt className="font-bold">Saturday</dt>
                    <dd className="ref-mono">By appointment</dd>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-4">
                    <dt className="font-bold">Sunday</dt>
                    <dd className="ref-mono">Closed</dd>
                  </div>
                </dl>
              </Reveal>
            </div>
          </section>

          <StoreLocatorMap />

          <section className="bg-surface-page pb-24">
            <Reveal className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
              <ContactEnquiryForm template={contactTemplate} />
            </Reveal>
          </section>
        </main>
        <SiteFooter />
      </div>
    </AdminPageEditLayer>
  );
}

function Card({
  icon: Icon,
  title,
  value,
  cta,
  note,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  cta: { label: string; href: string; external?: boolean };
  note: string;
}) {
  return (
    <div className="flex h-full min-h-[306px] flex-col rounded-[1.75rem] border border-border/70 bg-surface-card p-8 shadow-soft-warm sm:p-9 lg:p-10">
      <span className="grid size-10 place-items-center rounded-full bg-accent-terracotta-soft text-accent-terracotta">
        <Icon className="size-5" />
      </span>
      <h2 className="mt-7 font-display text-xl text-brand-deep">{title}</h2>
      <p className="mt-3 ref-mono text-base text-foreground">{value}</p>
      <p className="mt-2 text-xs font-bold leading-5 text-muted-foreground">{note}</p>
      <Button asChild variant="terracotta" size="pill" className="mt-auto w-full shadow-soft-warm">
        <a
          href={cta.href}
          target={cta.external ? "_blank" : undefined}
          rel={cta.external ? "noopener noreferrer" : undefined}
        >
          {cta.label}
        </a>
      </Button>
    </div>
  );
}
