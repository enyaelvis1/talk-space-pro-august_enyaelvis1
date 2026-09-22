import { createFileRoute, Link } from "@tanstack/react-router";
import { HeartHandshake, Leaf, ShieldCheck, Sparkles } from "lucide-react";

import { AdminPageEditLayer } from "@/components/site/AdminPageEditLayer";
import { EditablePublicPage } from "@/components/site/EditablePublicPage";
import { OptimizedImage } from "@/components/site/OptimizedImage";
import { Reveal } from "@/components/site/Reveal";
import { SectionBadge } from "@/components/site/SectionBadge";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteBreadcrumbs } from "@/components/site/SiteBreadcrumbs";
import { PublicRouteSkeleton } from "@/components/site/PublicRouteSkeleton";
import { Button } from "@/components/ui/button";
import { getPublishedEntry, type RenderedContentEntry } from "@/lib/content.functions";
import type { PageSection } from "@/lib/page-sections";
import { canonicalUrl, pageSeoHead } from "@/lib/seo";

import teamSessionImg from "@/assets/unsplash-african-team-session.jpg";
import conversationImg from "@/assets/unsplash-african-women-conversation.jpg";

export const Route = createFileRoute("/about")({
  loader: async () => {
    const entry = await getPublishedEntry({ data: { kind: "page", slug: "about" } });
    return { entry };
  },
  pendingMs: 0,
  pendingMinMs: 250,
  pendingComponent: () => (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <PublicRouteSkeleton pathname="/about" />
    </main>
  ),
  head: ({ loaderData }) => ({
    ...pageSeoHead({
      path: "/about",
      title: "About Talk Space | Our approach to counselling in Nigeria",
      description:
        "Meet the team behind Talk Space Counselling Services and the values that shape our confidential, professional therapy across Nigeria.",
      ogTitle: "About Talk Space Counselling Services",
      ogDescription:
        "Meet the team behind Talk Space and the values that shape our confidential, professional therapy across Nigeria.",
      entry: loaderData?.entry ?? null,
    }),
  }),
  component: RouteComponent,
});

const VALUES = [
  {
    icon: ShieldCheck,
    title: "Confidential by design",
    desc: "Everything you share is private, protected and used only to help you.",
  },
  {
    icon: HeartHandshake,
    title: "Culturally grounded",
    desc: "Therapists who understand family, faith, work and community in Nigeria.",
  },
  {
    icon: Leaf,
    title: "Care over cure",
    desc: "We meet you where you are, no jargon, no judgement, no rush.",
  },
  {
    icon: Sparkles,
    title: "Evidence-based",
    desc: "CBT, ACT, EMDR, systemic and relational modalities, chosen for you.",
  },
];

const ABOUT_STORY_PARAGRAPHS = [
  "Talk Space began in 2017 with a simple observation: too many people in Nigeria who wanted therapy either could not find a therapist they trusted, could not afford the ones they did find, or were held back by stigma.",
  "Today, our care coordinators match hundreds of clients each month with licensed therapists, online across Nigeria, and in person at our rooms in Gbagada, Lagos. We keep our fees transparent, hold a limited number of sliding-scale slots, and never take payment until your session is confirmed.",
  "If you are considering therapy for the first time, you are welcome here. The first conversation is often the hardest, and the most important.",
];

const ABOUT_STORY_IMAGE_SRC =
  "content-media/therapists/2026/08/b17cf861-9ef993a5-750797197-1617088680024620-7808186723757096404-n-13.jpg";
const ABOUT_STORY_IMAGE_ALT = "Talk Space therapist seated in a counselling room";
const LEGACY_ABOUT_INTRO_SECTION_ID = "hero-msp79f5r-u4nmvl";
const LEGACY_ABOUT_INTRO_BODY_START = "Before Talk Space was a practice";

const aboutStorySection: PageSection = {
  id: "about-story",
  type: "hero",
  hidden: false,
  surface: "page",
  spacing: "md",
  width: "wide",
  align: "left",
  eyebrow: "Our story",
  heading: "Built in Lagos. Made for anywhere you are.",
  headingEmphasis: "",
  headingAfter: "",
  body: ABOUT_STORY_PARAGRAPHS.join("\n\n"),
  image: {
    src: ABOUT_STORY_IMAGE_SRC,
    alt: ABOUT_STORY_IMAGE_ALT,
  },
  links: [],
};

function ensureAboutStory(entry: RenderedContentEntry): RenderedContentEntry {
  const sectionsWithoutLegacyIntro = entry.sections.filter((section) => {
    if (section.id === LEGACY_ABOUT_INTRO_SECTION_ID) return false;
    return !(
      section.id.startsWith("hero-") &&
      section.type === "hero" &&
      section.eyebrow === "About Talk Space" &&
      section.body.trim().startsWith(LEGACY_ABOUT_INTRO_BODY_START)
    );
  });
  const hasStory = sectionsWithoutLegacyIntro.some((section) => section.id === "about-story");
  if (hasStory) return { ...entry, sections: sectionsWithoutLegacyIntro };
  const valuesIndex = sectionsWithoutLegacyIntro.findIndex(
    (section) => section.id === "about-values",
  );
  const insertIndex = valuesIndex >= 0 ? valuesIndex + 1 : sectionsWithoutLegacyIntro.length;
  const sections = [
    ...sectionsWithoutLegacyIntro.slice(0, insertIndex),
    aboutStorySection,
    ...sectionsWithoutLegacyIntro.slice(insertIndex),
  ];
  return { ...entry, sections };
}

function RouteComponent() {
  const { entry } = Route.useLoaderData();
  if (entry) {
    return <EditablePublicPage entry={ensureAboutStory(entry)} label="About" />;
  }

  return (
    <AdminPageEditLayer slug="about" label="About">
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <SiteBreadcrumbs />
        <main id="main" className="flex-1">
          <section className="bg-surface-cream">
            <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 pt-16 pb-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8 lg:pt-24">
              <Reveal>
                <SectionBadge>About Talk Space</SectionBadge>
                <h1 className="display-1 mt-6 max-w-3xl text-brand-deep">
                  Therapy that feels human, professional and{" "}
                  <span className="italic text-accent-terracotta">close to home</span>.
                </h1>
                <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
                  Talk Space Counselling Services is a Nigerian practice of licensed therapists
                  offering confidential online and in-person support for individuals, couples,
                  families, teens and teams.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button asChild variant="terracotta" size="pill" className="shadow-soft-warm">
                    <Link to="/book">Book a session</Link>
                  </Button>
                  <Button asChild variant="pillOutline" size="pill">
                    <Link to="/services">Explore services</Link>
                  </Button>
                </div>
              </Reveal>
              <Reveal delay={120} className="relative">
                <div
                  aria-hidden
                  className="absolute -inset-3 rounded-[2rem] bg-accent-terracotta-soft/70"
                />
                <OptimizedImage
                  src={teamSessionImg}
                  alt="African therapists in a calm Talk Space team consultation"
                  width={1200}
                  height={900}
                  loading="eager"
                  fetchPriority="high"
                  sizes="(max-width: 1024px) calc(100vw - 2rem), 560px"
                  className="relative aspect-[4/3] w-full rounded-3xl object-cover shadow-soft-warm"
                />
              </Reveal>
            </div>
          </section>

          <section className="bg-white py-20 lg:py-24">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
              <Reveal>
                <SectionBadge className="bg-surface-cream text-brand-blue-deep">
                  Our values
                </SectionBadge>
                <h2 className="mt-6 max-w-4xl font-display text-3xl leading-tight text-brand-deep sm:text-4xl">
                  Four commitments we hold every session.
                </h2>
              </Reveal>
              <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                {VALUES.map((value, index) => (
                  <Reveal
                    key={value.title}
                    delay={index * 70}
                    className="flex min-h-[190px] flex-col rounded-[1.75rem] border border-border/70 bg-surface-card px-6 py-6 shadow-soft-warm"
                  >
                    <div className="grid size-11 place-items-center rounded-full bg-surface-cream text-brand-blue-deep">
                      <value.icon className="size-5" strokeWidth={1.8} aria-hidden />
                    </div>
                    <h3 className="mt-7 text-lg font-semibold text-brand-deep">{value.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{value.desc}</p>
                  </Reveal>
                ))}
              </div>
            </div>
          </section>

          <section className="bg-surface-page py-20 lg:py-24">
            <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.92fr_1fr] lg:gap-16 lg:px-8">
              <Reveal>
                <OptimizedImage
                  src={ABOUT_STORY_IMAGE_SRC}
                  alt={ABOUT_STORY_IMAGE_ALT}
                  width={1100}
                  height={900}
                  loading="lazy"
                  sizes="(max-width: 1024px) calc(100vw - 2rem), 540px"
                  className="aspect-[1.22/1] w-full rounded-[1.5rem] object-cover shadow-soft-warm"
                />
              </Reveal>
              <Reveal delay={100} className="max-w-3xl">
                <SectionBadge>Our story</SectionBadge>
                <h2 className="mt-6 font-display text-3xl leading-tight text-brand-deep sm:text-4xl">
                  Built in Lagos. Made for anywhere you are.
                </h2>
                <div className="mt-8 space-y-6 text-base leading-8 text-muted-foreground">
                  {ABOUT_STORY_PARAGRAPHS.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </Reveal>
            </div>
          </section>

          <section className="bg-surface-cream py-16 lg:py-20">
            <Reveal className="mx-auto grid w-full max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:px-8">
              <div>
                <SectionBadge tone="mint">Starting therapy</SectionBadge>
                <h2 className="mt-4 font-display text-brand-deep">
                  A care coordinator can help you choose the right fit.
                </h2>
                <p className="mt-4 max-w-2xl text-muted-foreground">
                  Tell us what you are carrying and how you would prefer to meet. We will recommend
                  a service, therapist match and next step without rushing the decision.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button asChild variant="terracotta" size="pill" className="shadow-soft-warm">
                    <Link to="/book">Book a session</Link>
                  </Button>
                  <Button asChild variant="pillOutline" size="pill">
                    <Link to="/contact">Talk to the care team</Link>
                  </Button>
                </div>
              </div>
              <OptimizedImage
                src={conversationImg}
                alt="Two African women in a warm counselling conversation"
                width={1000}
                height={760}
                loading="lazy"
                sizes="(max-width: 1024px) calc(100vw - 2rem), 520px"
                className="aspect-[4/3] w-full rounded-3xl object-cover shadow-soft-warm"
              />
            </Reveal>
          </section>
        </main>
        <SiteFooter />
      </div>
    </AdminPageEditLayer>
  );
}
