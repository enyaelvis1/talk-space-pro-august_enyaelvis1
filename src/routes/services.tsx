import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Baby,
  Building2,
  CalendarClock,
  Gem,
  HeartCrack,
  HeartHandshake,
  UserRound,
  Users,
} from "lucide-react";

import { AdminPageEditLayer } from "@/components/site/AdminPageEditLayer";
import { EditablePublicPage } from "@/components/site/EditablePublicPage";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { SiteFooter } from "@/components/site/SiteFooter";
import { OptimizedImage } from "@/components/site/OptimizedImage";
import { SectionBadge } from "@/components/site/SectionBadge";
import { Reveal } from "@/components/site/Reveal";
import { AutoPlayGallery } from "@/components/site/AutoPlayGallery";
import { Button } from "@/components/ui/button";
import { getPublishedEntry } from "@/lib/content.functions";
import { canonicalUrl, pageSeoHead } from "@/lib/seo";

function contentMediaUrl(path: string) {
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  return base ? `${base}/storage/v1/object/public/content-media/${path}` : "";
}

const serviceImages = {
  clarity:
    "sections/2026/08/eca919c2-770831590-1029866733355263-4296281925725283753-n-1920x1280.jpg",
  individual:
    "sections/2026/08/351ec8fd-769113572-1555211979488432-6994525042137175210-n-1920x1280.jpg",
  couple:
    "sections/2026/08/aa993092-66386938-769222501-1380979770890092-4763741222321324464-n-12.jpg",
  organizational:
    "sections/2026/08/d1658089-776985289-1756786902309458-3628311897889402613-n-1920x1440.jpg",
  premarital:
    "sections/2026/08/0f9dc550-772074689-989837150750115-7515797187889824263-n-1920x1280.jpg",
  infidelity:
    "sections/2026/08/93f29eda-777851941-2487662678414221-624607077780033235-n-1920x1280.jpg",
  teen: "sections/2026/08/a950940b-772773651-1561811785386572-3441361560306663636-n-2-1920x1280.jpg",
  family:
    "sections/2026/08/8dfa8849-772664478-2225233714704868-4295635343480778589-n-2-1920x1280.jpg",
} as const;

export const Route = createFileRoute("/services")({
  loader: async () => {
    const entry = await getPublishedEntry({ data: { kind: "page", slug: "services" } });
    return { entry };
  },
  head: ({ loaderData }) => ({
    ...pageSeoHead({
      path: "/services",
      title: "Services | Therapy, counselling & workplace mental health",
      description:
        "Explore Talk Space counselling services: clarity calls, individual therapy, couple therapy, organizational counselling, premarital counselling, infidelity recovery, teen/child therapy and family therapy.",
      ogTitle: "Talk Space Counselling Services",
      ogDescription:
        "Clarity calls, individual, couple, workplace, premarital, infidelity recovery, teen/child and family counselling, online or in person across Nigeria.",
      entry: loaderData?.entry ?? null,
    }),
  }),
  component: RouteComponent,
});

const SERVICES = [
  {
    id: "clarity-call",
    icon: CalendarClock,
    title: "Clarity Call",
    tagline: "A focused 15-minute first step.",
    desc: "A short paid consultation for clients who want help choosing the right service, understanding next steps, or asking a focused question before booking therapy.",
    bullets: [
      "15-minute online or phone consultation",
      "Best for fit, direction and next-step guidance",
      "Not a full therapy session or emergency support",
    ],
    image: contentMediaUrl(serviceImages.clarity),
    alt: "African care team discussing a counselling intake plan",
  },
  {
    id: "individual",
    icon: UserRound,
    title: "Individual Therapy",
    tagline: "One-to-one support, at your pace.",
    desc: "For anxiety, depression, burnout, grief, self-esteem, identity and life transitions. Weekly or fortnightly 50-minute sessions with the same therapist throughout.",
    bullets: [
      "CBT, ACT, psychodynamic and integrative approaches",
      "Online video or in-person at our Lagos rooms",
      "Free 15-minute intro call available on request",
    ],
    image: contentMediaUrl(serviceImages.individual),
    alt: "A Nigerian therapist and client in a warm one-to-one counselling session",
  },
  {
    id: "couple",
    icon: HeartHandshake,
    title: "Couple Therapy",
    tagline: "For the relationship you want to keep growing.",
    desc: "For couples navigating conflict, communication, intimacy, parenting differences, trust issues, or the pressure of repeated unresolved arguments.",
    bullets: [
      "Emotion-focused and Gottman-informed approaches",
      "75-minute sessions with a relational therapist",
      "Individual check-ins available alongside joint sessions",
    ],
    image: contentMediaUrl(serviceImages.couple),
    alt: "A young African couple holding hands during a couples therapy session",
  },
  {
    id: "organizational",
    icon: Building2,
    title: "Organizational Counselling",
    tagline: "Mental health support for healthier teams.",
    desc: "For organisations that want confidential employee support, workplace wellness sessions, leadership coaching, and practical care for burnout, stress and team conflict.",
    bullets: [
      "EAP-style individual support for staff",
      "Team wellness sessions and psychoeducation",
      "Workplace conflict, burnout and leadership support",
    ],
    image: contentMediaUrl(serviceImages.organizational),
    alt: "African professionals in a calm workplace counselling conversation",
  },
  {
    id: "premarital",
    icon: Gem,
    title: "Premarital Counselling",
    tagline: "Prepare for marriage with clarity and care.",
    desc: "Structured sessions for engaged or seriously committed partners who want to explore expectations, communication, family systems, faith, finances and shared values before marriage.",
    bullets: [
      "Communication, conflict and expectation mapping",
      "Values, finances, family boundaries and intimacy",
      "Personal and couple profiling where appropriate",
    ],
    image: contentMediaUrl(serviceImages.premarital),
    alt: "An African couple in a calm counselling conversation",
  },
  {
    id: "infidelity-recovery",
    icon: HeartCrack,
    title: "Infidelity Recovery Therapy",
    tagline: "Structured support after betrayal.",
    desc: "Compassionate therapy for individuals or couples processing betrayal, disclosure, grief, anger, repair, boundaries, and decisions about whether and how to rebuild trust.",
    bullets: [
      "Stabilise emotions and reduce repeated conflict",
      "Process betrayal, disclosure and repair conversations",
      "Rebuild trust or make clear decisions with support",
    ],
    image: contentMediaUrl(serviceImages.infidelity),
    alt: "An African couple in a serious counselling conversation",
  },
  {
    id: "teen-child",
    icon: Baby,
    title: "Teen/Child Therapy",
    tagline: "Specialist care for younger clients.",
    desc: "Support for children and adolescents experiencing behavioural concerns, anxiety, school-related stress, emotional regulation challenges or family transitions.",
    bullets: [
      "Behavioural, play-informed and art-informed therapy",
      "Parent guidance and family collaboration",
      "Age-appropriate care from specialist clinicians",
    ],
    image: contentMediaUrl(serviceImages.teen),
    alt: "An African family seated together in a warm home setting",
  },
  {
    id: "family",
    icon: Users,
    title: "Family Therapy",
    tagline: "Bring the whole system into the room.",
    desc: "For families navigating conflict, sibling rivalry, blended households, elder care tension, parenting differences or major life transitions.",
    bullets: [
      "Systemic and structural family therapy",
      "Support for intergenerational relationships",
      "Sessions include the members most affected",
    ],
    image: contentMediaUrl(serviceImages.family),
    alt: "A small group of African adults in a circle in a family therapy session",
  },
];

function RouteComponent() {
  const { entry } = Route.useLoaderData();
  if (entry) {
    return <EditablePublicPage entry={entry} label="Services" />;
  }

  return (
    <AdminPageEditLayer slug="services" label="Services">
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <SiteBreadcrumbs />
        <main id="main" className="flex-1">
          <section className="bg-surface-cream">
            <div className="mx-auto w-full max-w-7xl px-4 pt-16 pb-12 sm:px-6 lg:px-8 lg:pt-24">
              <Reveal className="flex flex-col items-center text-center">
                <SectionBadge>Our Services</SectionBadge>
                <h1 className="display-1 mt-6 max-w-3xl text-brand-deep">
                  Care shaped around the{" "}
                  <span className="italic text-accent-terracotta">person</span> in front of us.
                </h1>
                <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
                  Every Talk Space service is delivered by a licensed Nigerian therapist. Choose the
                  format that fits, or ask us and we will recommend one after a short conversation.
                </p>
              </Reveal>
            </div>
            <Reveal delay={120}>
              <AutoPlayGallery
                className="pb-14"
                images={SERVICES.map((s) => ({ src: s.image, alt: s.alt, caption: s.title }))}
                durationSeconds={50}
              />
            </Reveal>
          </section>

          <section className="bg-surface-page pb-24">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-4 pt-20 sm:px-6 lg:px-8 lg:gap-24">
              {SERVICES.map((s, i) => {
                const reverse = i % 2 === 1;
                return (
                  <Reveal
                    key={s.id}
                    as="article"
                    className="grid scroll-mt-24 gap-10 lg:grid-cols-2 lg:items-center lg:gap-16"
                  >
                    <div id={s.id} className={reverse ? "lg:order-2" : ""}>
                      <div className="relative">
                        <div
                          aria-hidden
                          className="absolute -inset-3 rounded-[2rem] bg-accent-terracotta-soft/70"
                        />
                        <OptimizedImage
                          src={s.image}
                          alt={s.alt}
                          width={1024}
                          height={768}
                          loading="lazy"
                          sizes="(max-width: 1024px) calc(100vw - 2rem), 50vw"
                          className="relative h-[380px] w-full rounded-3xl object-cover shadow-soft-warm"
                        />
                      </div>
                    </div>
                    <div>
                      <SectionBadge>
                        <s.icon className="h-3.5 w-3.5" />
                        <span className="ml-1.5">{s.title}</span>
                      </SectionBadge>
                      <h2 className="mt-4 font-display text-brand-deep">{s.tagline}</h2>
                      <p className="mt-4 text-muted-foreground">{s.desc}</p>
                      <ul className="mt-6 space-y-2 text-sm">
                        {s.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-2">
                            <span
                              aria-hidden
                              className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-accent-terracotta"
                            />
                            {b}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-8 flex flex-wrap gap-3">
                        <Button
                          asChild
                          variant="terracotta"
                          size="pill"
                          className="shadow-soft-warm"
                        >
                          <Link to="/book">
                            Book {s.title.toLowerCase()}
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button asChild variant="pillOutline" size="pill">
                          <Link to="/pricing">See pricing</Link>
                        </Button>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    </AdminPageEditLayer>
  );
}
