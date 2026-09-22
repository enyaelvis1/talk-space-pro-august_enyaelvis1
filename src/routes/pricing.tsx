import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { z } from "zod";

import { AdminPageEditLayer } from "@/components/site/AdminPageEditLayer";
import { EditablePublicPage } from "@/components/site/EditablePublicPage";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { PublicRouteSkeleton } from "@/components/site/PublicRouteSkeleton";
import { SectionBadge } from "@/components/site/SectionBadge";
import { Reveal } from "@/components/site/Reveal";
import { Button } from "@/components/ui/button";
import { getPublishedEntry, type RenderedContentEntry } from "@/lib/content.functions";
import type { PageSection } from "@/lib/page-sections";
import { cn } from "@/lib/utils";
import { WHATSAPP_HREF } from "@/lib/talkspace";
import { canonicalUrl, pageSeoHead } from "@/lib/seo";

export const Route = createFileRoute("/pricing")({
  loader: async () => {
    const entry = await getPublishedEntry({ data: { kind: "page", slug: "pricing" } });
    return { entry };
  },
  pendingMs: 0,
  pendingMinMs: 250,
  pendingComponent: () => (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <PublicRouteSkeleton pathname="/pricing" />
    </main>
  ),
  validateSearch: z.object({
    service: z.string().trim().optional(),
  }),
  head: ({ loaderData }) => ({
    ...pageSeoHead({
      path: "/pricing",
      title: "Pricing | Affordable therapy plans in Nigeria | Talk Space",
      description:
        "Talk Space counselling fees: individual therapy \u20a655,000, couple therapy \u20a690,000, teen/child therapy \u20a650,000. Monthly plans and psychotherapy also available.",
      ogTitle: "Talk Space Pricing",
      ogDescription: "Affordable therapy plans for individuals, couples and families.",
      entry: loaderData?.entry ?? null,
    }),
  }),
  component: RouteComponent,
});

type PricingPlan = {
  name: string;
  price: string;
  usd?: string;
  cadence: string;
  desc: string;
  features: string[];
  href: string;
  action: string;
  highlight?: boolean;
  note?: string;
  serviceCode?: string;
};

type PricingGroup = {
  eyebrow: string;
  title: string;
  summary: string;
  plans: PricingPlan[];
};

const PRICING_GROUPS: PricingGroup[] = [
  {
    eyebrow: "Single sessions",
    title: "Pay per session.",
    summary:
      "Best for first appointments, focused support, or clients who prefer to book one session at a time.",
    plans: [
      {
        name: "Clarity Call",
        price: "Contact for pricing",
        cadence: "per 15-minute consultation",
        desc: "A short paid call to choose the right service, ask a focused question, or plan your next step.",
        features: [
          "15-minute online or phone call",
          "Service-fit guidance",
          "Clear next-step recommendation",
          "Not a full therapy session",
        ],
        href: WHATSAPP_HREF,
        action: "Request a call",
        note: "Price and Paystack link to be confirmed.",
      },
      {
        name: "Individual Therapy",
        price: "₦55,000",
        usd: "≈ $40",
        cadence: "per 60-minute session",
        desc: "One-to-one online counselling tailored to your current concerns and treatment goals.",
        features: [
          "Online video session",
          "CBT-informed support",
          "Mindfulness and solution-focused tools",
          "Personalised next steps after session",
        ],
        href: "/book?service=individual&mode=online",
        action: "Start secure booking",
        serviceCode: "individual",
      },
      {
        name: "Couple Therapy",
        price: "₦90,000",
        usd: "≈ $70",
        cadence: "per 90-minute session",
        desc: "Structured couple therapy for communication, trust repair, conflict and emotional intimacy.",
        features: [
          "Online video session",
          "Couple assessment and profiling",
          "Communication and conflict skills",
          "Infidelity-sensitive support when needed",
        ],
        href: "/book?service=couple&mode=online",
        action: "Start secure booking",
        serviceCode: "couple",
        highlight: true,
      },
      {
        name: "Child/Teen Therapy",
        price: "₦50,000",
        usd: "≈ $37",
        cadence: "per 60-minute session",
        desc: "Specialist support for children and adolescents, with age-appropriate therapeutic methods.",
        features: [
          "Behavioural and emotional support",
          "School-related concerns",
          "Play, art and talk therapy methods",
          "Parent guidance where appropriate",
        ],
        href: WHATSAPP_HREF,
        action: "Request a slot",
        note: "Paystack link to be confirmed.",
      },
    ],
  },
  {
    eyebrow: "In-person sessions",
    title: "Physical sessions at our rooms.",
    summary:
      "For clients who prefer face-to-face support. In-person sessions are available by appointment.",
    plans: [
      {
        name: "Individual In-person Session",
        price: "₦85,000",
        cadence: "per 60-minute session",
        desc: "One-to-one counselling in a private Talk Space room, tailored to your treatment goals.",
        features: [
          "Physical session by appointment",
          "Private counselling room",
          "CBT-informed support",
          "Personalised next steps after session",
        ],
        href: "/book?service=individual&mode=in_person",
        action: "Start secure booking",
        serviceCode: "individual",
      },
      {
        name: "Couple In-person Session",
        price: "₦130,000",
        cadence: "per 90-minute session",
        desc: "Face-to-face couple therapy for communication, trust repair, conflict and intimacy.",
        features: [
          "Physical couple session",
          "Couple assessment and profiling",
          "Communication and conflict skills",
          "Infidelity-sensitive support when needed",
        ],
        href: "/book?service=couple&mode=in_person",
        action: "Start secure booking",
        serviceCode: "couple",
        highlight: true,
      },
      {
        name: "One-Month Individual In-person",
        price: "₦323,000",
        cadence: "4 individual sessions monthly",
        desc: "Four face-to-face individual therapy sessions with the same therapist.",
        features: [
          "Four physical sessions",
          "Consistent therapist match",
          "Progress tracking between sessions",
          "Structured short-course care",
        ],
        href: "/purchase?service=one_month_individual&mode=in_person",
        action: "Purchase sessions",
        serviceCode: "one_month_individual",
      },
      {
        name: "One-Month Couple In-person",
        price: "₦494,000",
        cadence: "4 couple sessions monthly",
        desc: "A structured month of in-person couple therapy for reconnection and repair.",
        features: [
          "Four physical couple sessions",
          "Assessment-led treatment plan",
          "Communication and intimacy work",
          "Support for recurring conflict cycles",
        ],
        href: "/purchase?service=one_month_couple&mode=in_person",
        action: "Purchase sessions",
        serviceCode: "one_month_couple",
        highlight: true,
      },
    ],
  },
  {
    eyebrow: "Monthly packages",
    title: "Commit to a short course of care.",
    summary:
      "Four-session plans for clients who want rhythm, continuity and a clearer therapeutic arc.",
    plans: [
      {
        name: "Individual Plan",
        price: "₦210,000",
        usd: "≈ $155",
        cadence: "4 individual sessions monthly",
        desc: "A focused month of individual therapy with the same therapist and structured follow-up.",
        features: [
          "Four online sessions",
          "Consistent therapist match",
          "Progress tracking between sessions",
          "Most affordable individual route",
        ],
        href: "/purchase?service=one_month_individual&mode=online",
        action: "Purchase sessions",
        serviceCode: "one_month_individual",
      },
      {
        name: "Couple Plan",
        price: "₦342,000",
        usd: "≈ $260",
        cadence: "4 couple sessions monthly",
        desc: "A structured month of couple therapy for communication, reconnection and repair.",
        features: [
          "Four online couple sessions",
          "Assessment-led treatment plan",
          "Communication and intimacy work",
          "Support for recurring conflict cycles",
        ],
        href: "/purchase?service=one_month_couple&mode=online",
        action: "Purchase sessions",
        serviceCode: "one_month_couple",
        highlight: true,
      },
      {
        name: "Premarital Plan",
        price: "Contact for pricing",
        cadence: "structured premarital package",
        desc: "Guided sessions for engaged or seriously committed partners preparing for marriage.",
        features: [
          "Communication and expectations",
          "Family systems and in-law conversations",
          "Finance, faith and shared values",
          "Personalised couple recommendations",
        ],
        href: WHATSAPP_HREF,
        action: "Ask for package",
        note: "Price and Paystack link to be confirmed.",
      },
    ],
  },
  {
    eyebrow: "Specialized packages",
    title: "Care for complex or specialist needs.",
    summary:
      "Specialist support for deeper therapeutic work, relationship repair and workplace wellbeing.",
    plans: [
      {
        name: "Psychotherapy",
        price: "₦100,000",
        usd: "≈ $75",
        cadence: "per specialist session",
        desc: "In-depth therapy for clients who need a detailed psychological assessment and treatment plan.",
        features: [
          "Specialist assessment",
          "Structured treatment goals",
          "Online confidential sessions",
          "Suitable for complex emotional patterns",
        ],
        href: WHATSAPP_HREF,
        action: "Request a slot",
        note: "Paystack link to be confirmed.",
      },
      {
        name: "Infidelity Recovery",
        price: "Contact for pricing",
        cadence: "specialist couple package",
        desc: "Careful, structured support for couples navigating betrayal, disclosure and trust repair.",
        features: [
          "Stabilisation after disclosure",
          "Trust repair framework",
          "Individual and joint support options",
          "Clear next-step recommendations",
        ],
        href: WHATSAPP_HREF,
        action: "Ask for package",
        note: "Price and Paystack link to be confirmed.",
      },
      {
        name: "Organizational Counselling",
        price: "Custom quote",
        cadence: "team, HR or workplace programme",
        desc: "Confidential employee support, wellness sessions and workplace mental health programming.",
        features: [
          "Corporate counselling support",
          "Team wellness sessions",
          "Burnout and stress care",
          "Corporate invoicing available",
        ],
        href: WHATSAPP_HREF,
        action: "Request a quote",
        note: "Scope, price and payment link depend on programme size.",
      },
    ],
  },
];

const FAQS = [
  {
    q: "When is payment taken?",
    a: "Payments are processed securely via Paystack when you book. If you need to reschedule or cancel, do so at least 48 hours in advance.",
  },
  {
    q: "What payment methods do you accept?",
    a: "Card (Visa, Mastercard, Verve), bank transfer and USSD via Paystack. Corporate invoicing is available for HR-sponsored programmes.",
  },
  {
    q: "Do you offer diaspora pricing?",
    a: "Yes. USD equivalents are shown for each plan and you can pay in either currency via Paystack.",
  },
  {
    q: "Can I book a package rather than pay per session?",
    a: "Yes. Our one-month plans (four sessions) are the most affordable way to commit to a short course of therapy.",
  },
];

const pricingFaqSection: PageSection = {
  id: "pricing-faq",
  type: "faq",
  hidden: false,
  surface: "page",
  spacing: "lg",
  width: "wide",
  align: "left",
  eyebrow: "Billing FAQ",
  heading: "Common questions about fees.",
  body: "",
  items: FAQS.map((faq) => ({
    id: faq.q
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, ""),
    question: faq.q,
    answer: faq.a,
  })),
};

function ensurePricingFaq(entry: RenderedContentEntry): RenderedContentEntry {
  const sections = entry.sections.map((section) =>
    section.id === "pricing-hero" ? { ...section, align: "left" as const } : section,
  );
  const draftSections = entry.draftSections.map((section) =>
    section.id === "pricing-hero" ? { ...section, align: "left" as const } : section,
  );
  const normalizedEntry = { ...entry, sections, draftSections };
  const hasFaq = sections.some((section) => section.id === "pricing-faq");
  if (hasFaq) return normalizedEntry;
  const noteIndex = entry.sections.findIndex((section) => section.id === "pricing-note");
  const insertIndex = noteIndex >= 0 ? noteIndex + 1 : entry.sections.length;
  return {
    ...normalizedEntry,
    sections: [
      ...sections.slice(0, insertIndex),
      pricingFaqSection,
      ...sections.slice(insertIndex),
    ],
  };
}

function RouteComponent() {
  const { entry } = Route.useLoaderData();

  if (entry) {
    return <EditablePublicPage entry={ensurePricingFaq(entry)} label="Pricing" />;
  }

  return (
    <AdminPageEditLayer slug="pricing" label="Pricing">
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <SiteBreadcrumbs />
        <main id="main" className="flex-1">
          <section className="bg-surface-cream">
            <div className="mx-auto w-full max-w-7xl px-4 pt-16 pb-14 sm:px-6 lg:px-8 lg:pt-24">
              <Reveal className="max-w-3xl">
                <SectionBadge>Affordable therapy plans</SectionBadge>
                <h1 className="display-1 mt-6 max-w-3xl text-brand-deep">
                  Professional counselling —{" "}
                  <span className="italic text-accent-terracotta">accessible</span>.
                </h1>
                <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
                  Transparent fees for individuals, couples and families in Nigeria and the
                  diaspora. Payments processed securely via Paystack.
                </p>
              </Reveal>
            </div>
          </section>

          <section className="bg-surface-page pb-16 pt-16">
            <div className="mx-auto w-full max-w-7xl space-y-10 px-4 sm:px-6 lg:px-8">
              {PRICING_GROUPS.map((group) => (
                <Reveal
                  key={group.eyebrow}
                  as="section"
                  aria-labelledby={`pricing-${group.eyebrow.toLowerCase().replace(/\s+/g, "-")}`}
                  className="rounded-3xl border border-border/60 bg-white p-5 shadow-soft-warm sm:p-6 lg:p-8"
                >
                  <div className="grid gap-6 lg:grid-cols-[0.75fr_1.5fr]">
                    <div>
                      <SectionBadge>{group.eyebrow}</SectionBadge>
                      <h2
                        id={`pricing-${group.eyebrow.toLowerCase().replace(/\s+/g, "-")}`}
                        className="mt-4 font-display text-2xl text-brand-deep"
                      >
                        {group.title}
                      </h2>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {group.summary}
                      </p>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                      {group.plans.map((p) => (
                        <article
                          key={p.name}
                          className={cn(
                            "flex min-h-full flex-col rounded-2xl border p-5",
                            p.highlight
                              ? "border-accent-terracotta bg-brand-deep text-white shadow-soft-warm"
                              : "border-border/60 bg-card",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <h3
                              className={cn(
                                "font-display text-lg",
                                p.highlight ? "text-white" : "text-brand-deep",
                              )}
                            >
                              {p.name}
                            </h3>
                            {p.highlight && (
                              <span className="rounded-full bg-accent-terracotta px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                                Popular
                              </span>
                            )}
                          </div>

                          <div className="mt-5">
                            <span
                              className={cn(
                                "ref-mono text-3xl font-semibold",
                                p.highlight ? "text-white" : "text-brand-deep",
                              )}
                            >
                              {p.price}
                            </span>
                            <p
                              className={cn(
                                "mt-1 text-xs",
                                p.highlight ? "text-white/70" : "text-muted-foreground",
                              )}
                            >
                              {[p.usd, p.cadence].filter(Boolean).join(" · ")}
                            </p>
                          </div>

                          <p
                            className={cn(
                              "mt-4 text-sm leading-6",
                              p.highlight ? "text-white/80" : "text-muted-foreground",
                            )}
                          >
                            {p.desc}
                          </p>

                          <ul className="mt-5 flex-1 space-y-2 text-sm">
                            {p.features.map((f) => (
                              <li key={f} className="flex items-start gap-2">
                                <Check
                                  className={cn(
                                    "mt-0.5 h-4 w-4 flex-none",
                                    p.highlight
                                      ? "text-accent-terracotta"
                                      : "text-accent-terracotta",
                                  )}
                                />
                                <span className={p.highlight ? "text-white/90" : ""}>{f}</span>
                              </li>
                            ))}
                          </ul>

                          {p.note && (
                            <p
                              className={cn(
                                "mt-5 rounded-lg px-3 py-2 text-xs",
                                p.highlight
                                  ? "bg-white/10 text-white/80"
                                  : "bg-accent-terracotta-soft/50 text-muted-foreground",
                              )}
                            >
                              {p.note}
                            </p>
                          )}

                          <Button
                            asChild
                            size="pill"
                            className={cn(
                              "mt-6 shadow-soft-warm",
                              p.highlight
                                ? "bg-white text-brand-deep hover:bg-white/90"
                                : "bg-accent-terracotta text-white hover:bg-accent-terracotta/90",
                            )}
                          >
                            <a
                              href={p.href}
                              target={p.serviceCode ? undefined : "_blank"}
                              rel={p.serviceCode ? undefined : "noopener noreferrer"}
                            >
                              {p.action}
                            </a>
                          </Button>
                        </article>
                      ))}
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <section className="bg-surface-page py-20">
            <Reveal className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:px-8">
              <div>
                <SectionBadge>Billing FAQ</SectionBadge>
                <h2 className="mt-4 font-display text-brand-deep">Common questions about fees.</h2>
              </div>
              <dl className="divide-y divide-border/70">
                {FAQS.map((f) => (
                  <div key={f.q} className="py-5">
                    <dt className="text-base font-medium text-brand-deep">{f.q}</dt>
                    <dd className="mt-2 text-sm text-muted-foreground">{f.a}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </section>
        </main>
        <SiteFooter />
      </div>
    </AdminPageEditLayer>
  );
}
